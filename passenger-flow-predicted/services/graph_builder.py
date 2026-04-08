import numpy as np
import torch
from sklearn.metrics.pairwise import haversine_distances

class GraphBuilder:

    def __init__(self, sigma: float = 0.5):
        self.sigma = sigma

    def build_from_coordinates(self, coords: np.ndarray, device: torch.device = None) -> torch.Tensor:
        """
        Строит матрицу смежности по координатам.
        """
        coords = np.asarray(coords, dtype=np.float64)

        if coords.ndim != 2 or coords.shape[1] != 2:
            raise ValueError("coords must be [N, 2]")

        rad = np.radians(coords)
        dist = haversine_distances(rad) * 6371.0

        A = np.exp(-(dist ** 2) / (2 * self.sigma ** 2))
        np.fill_diagonal(A, 1.0)

        return torch.tensor(A, dtype=torch.float32, device=device)
