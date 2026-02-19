import numpy as np
from sklearn.cluster import KMeans

class StopClusteringService:

    def cluster(self, nodes, n_clusters=5):
        features = []
        for n in nodes:
            features.append([
                n.lat,
                n.lng,
                np.mean(n.historical_counts) if n.historical_counts else 0
            ])

        kmeans = KMeans(n_clusters=n_clusters, random_state=42)
        labels = kmeans.fit_predict(features)

        return labels