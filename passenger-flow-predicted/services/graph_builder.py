from typing import List, Union

import numpy as np
import torch
from sklearn.metrics.pairwise import haversine_distances

class GraphBuilder:

    def __init__(self, sigma: float = 0.5):
        self.sigma = sigma

    def build_from_coordinates(self, latlng: Union[List[List[float]], np.ndarray]) -> torch.Tensor:
        """
        Строит матрицу смежности по координатам.
        """
        coords = np.radians(latlng)
        dist = haversine_distances(coords) * 6371  # км

        # Чем ближе — тем сильнее связь
        sigma = 0.5
        A = np.exp(-dist ** 2 / (2 * sigma ** 2))

        np.fill_diagonal(A, 1.0)
        return torch.tensor(A, dtype=torch.float32)
