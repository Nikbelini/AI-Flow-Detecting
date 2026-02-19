import numpy as np
import torch
from sklearn.metrics.pairwise import haversine_distances

class GraphBuilder:

    def build_from_coordinates(self, latlng):
        """
        latlng: [(lat, lng), ...]
        """
        coords = np.radians(latlng)
        dist = haversine_distances(coords) * 6371  # км

        # Чем ближе — тем сильнее связь
        sigma = 0.5
        A = np.exp(-dist ** 2 / (2 * sigma ** 2))

        np.fill_diagonal(A, 1)
        return torch.tensor(A, dtype=torch.float32)
