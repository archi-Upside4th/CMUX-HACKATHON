"""Item recommender — sklearn 기반 추천."""
from sklearn.neighbors import NearestNeighbors
import numpy as np


def fit_recommender(item_features: np.ndarray):
    nn = NearestNeighbors(n_neighbors=5)
    nn.fit(item_features)
    return nn


def recommend(model, user_vector: np.ndarray):
    distances, indices = model.kneighbors([user_vector])
    return indices[0].tolist()
