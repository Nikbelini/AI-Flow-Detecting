import logging
import numpy as np
import torch
from sklearn.metrics.pairwise import haversine_distances

logger = logging.getLogger(__name__)

class GraphBuilder:

    def __init__(self, sigma: float = None, k_neighbors: int = 7):
        self.sigma = sigma
        self.k_neighbors = k_neighbors

    def build_from_coordinates(self, coords: np.ndarray, device: torch.device = None) -> torch.Tensor:
        """
        Строит матрицу смежности по координатам.
        """
        coords = np.asarray(coords, dtype=np.float64)

        if coords.ndim != 2 or coords.shape[1] != 2:
            raise ValueError("coords must be [N, 2]")

        rad = np.radians(coords)
        dist = haversine_distances(rad) * 6371.0

        # Адаптивный sigma - медиана реальных расстояний между соседями
        if self.sigma is None:
            nonzero_dists = dist[dist > 0]
            if len(nonzero_dists) > 0:
                sigma = float(np.median(nonzero_dists)) / 2.0
            else:
                sigma = 1.0 
        else:
            sigma = self.sigma

        logging.info(
            f"[GraphBuilder] sigma={sigma:.3f} km, "
            f"dist: min={dist[dist>0].min():.2f}, "
            f"median={np.median(dist[dist>0]):.2f}, "
            f"max={dist.max():.2f}"
        )

        # Gaussian kernel
        A = np.exp(-(dist ** 2) / (2 * sigma ** 2))

        # kNN оставить только топ-k соседей
        k = min(self.k_neighbors, len(coords) - 1)
        A_sparse = np.zeros_like(A)
        for i in range(len(A)):
            row = A[i].copy()
            row[i] = 0.0  # временно убрать диагональ при выборе соседей
            if k > 0:
                top_k_idx = np.argpartition(row, -k)[-k:]
                A_sparse[i, top_k_idx] = row[top_k_idx]
                A_sparse[top_k_idx, i] = row[top_k_idx]  # симметрия

        np.fill_diagonal(A_sparse, 1.0)

        return torch.tensor(A_sparse, dtype=torch.float32, device=device)
