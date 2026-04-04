// src/api/scenariosApi.ts
import { modelingUrl } from '../pages/Map/env';
import type { Modification } from '../pages/SimulationPage';

// ========== ТИПЫ ==========

export interface Scenario {
  id: string;
  name: string;
  description: string;
  modifications: Modification[];
  created_at: string;
  updated_at?: string;
  version?: number;
  created_by?: string;
  source_scenario?: string;
  is_favorite?: boolean;
  tags?: string[];
}

export interface ScenarioCreateRequest {
  name: string;
  description?: string;
  modifications: Modification[];
  created_by?: string;
  tags?: string[];
}

export interface ScenarioUpdateRequest {
  name?: string;
  description?: string;
  modifications?: Modification[];
  is_favorite?: boolean;
  tags?: string[];
}

export interface ScenarioDuplicateRequest {
  new_name: string;
}

export interface ScenarioListResponse {
  city_id: number;
  scenarios: Scenario[];
  count: number;
}

export interface ScenarioSimulateRequest {
  city_id: number;
  scenario_id: string;
}

// Базовый URL для modeling service
const BASE_URL = modelingUrl || 'http://localhost:8084';

// Вспомогательная функция для запросов
const request = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `HTTP error! status: ${response.status}`);
  }

  return response.json();
};

// ========== API ==========

export const scenariosApi = {
  /**
   * Создать новый сценарий
   * @param cityId - ID города
   * @param request - Данные сценария
   * @returns Созданный сценарий с ID
   */
  createScenario: async (cityId: number, data: ScenarioCreateRequest): Promise<{ status: string; scenario_id: string; scenario: Scenario }> => {
    try {
      return await request(`/scenario/${cityId}`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error('Error creating scenario:', error);
      throw error;
    }
  },

  /**
   * Получить сценарий по ID
   * @param cityId - ID города
   * @param scenarioId - ID сценария
   * @returns Сценарий
   */
  getScenario: async (cityId: number, scenarioId: string): Promise<Scenario> => {
    try {
      return await request(`/scenario/${cityId}/${scenarioId}`);
    } catch (error) {
      console.error(`Error fetching scenario ${scenarioId}:`, error);
      throw error;
    }
  },

  /**
   * Получить список всех сценариев для города
   * @param cityId - ID города
   * @returns Список сценариев
   */
  listScenarios: async (cityId: number): Promise<ScenarioListResponse> => {
    try {
      return await request(`/scenario/${cityId}`);
    } catch (error) {
      console.error(`Error listing scenarios for city ${cityId}:`, error);
      throw error;
    }
  },

  /**
   * Обновить сценарий
   * @param cityId - ID города
   * @param scenarioId - ID сценария
   * @param request - Данные для обновления
   * @returns Обновлённый сценарий
   */
  updateScenario: async (
    cityId: number,
    scenarioId: string,
    data: ScenarioUpdateRequest
  ): Promise<{ status: string; scenario: Scenario }> => {
    try {
      return await request(`/scenario/${cityId}/${scenarioId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error(`Error updating scenario ${scenarioId}:`, error);
      throw error;
    }
  },

  /**
   * Удалить сценарий
   * @param cityId - ID города
   * @param scenarioId - ID сценария
   * @returns Статус удаления
   */
  deleteScenario: async (cityId: number, scenarioId: string): Promise<{ status: string; scenario_id: string }> => {
    try {
      return await request(`/scenario/${cityId}/${scenarioId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error(`Error deleting scenario ${scenarioId}:`, error);
      throw error;
    }
  },

  /**
   * Копировать сценарий
   * @param cityId - ID города
   * @param scenarioId - ID исходного сценария
   * @param request - Данные для копирования
   * @returns Новый ID сценария
   */
  duplicateScenario: async (
    cityId: number,
    scenarioId: string,
    data: ScenarioDuplicateRequest
  ): Promise<{ status: string; new_scenario_id: string }> => {
    try {
      return await request(`/scenario/${cityId}/${scenarioId}/duplicate`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error(`Error duplicating scenario ${scenarioId}:`, error);
      throw error;
    }
  },

  /**
   * Запустить симуляцию из сохранённого сценария
   * @param request - Запрос на симуляцию
   * @returns Результаты симуляции
   */
  simulateFromScenario: async (data: ScenarioSimulateRequest): Promise<any> => {
    try {
      return await request('/simulate/from_scenario', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error('Error simulating from scenario:', error);
      throw error;
    }
  },

  /**
   * Сохранить текущие модификации как новый сценарий
   * @param cityId - ID города
   * @param name - Название сценария
   * @param modifications - Список модификаций
   * @param description - Описание (опционально)
   * @returns Созданный сценарий
   */
  saveCurrentModifications: async (
    cityId: number,
    name: string,
    modifications: Modification[],
    description?: string
  ): Promise<{ status: string; scenario_id: string; scenario: Scenario }> => {
    return scenariosApi.createScenario(cityId, {
      name,
      description: description || `Сценарий от ${new Date().toLocaleString()}`,
      modifications,
      created_by: 'user'
    });
  },

  /**
   * Загрузить сценарий в текущие модификации
   * @param cityId - ID города
   * @param scenarioId - ID сценария
   * @returns Модификации сценария
   */
  loadScenarioModifications: async (cityId: number, scenarioId: string): Promise<Modification[]> => {
    const scenario = await scenariosApi.getScenario(cityId, scenarioId);
    return scenario.modifications;
  },

  /**
   * Поиск сценариев по названию
   * @param cityId - ID города
   * @param query - Поисковый запрос
   * @returns Найденные сценарии
   */
  searchScenarios: async (cityId: number, query: string): Promise<Scenario[]> => {
    const response = await scenariosApi.listScenarios(cityId);
    const scenarios = response.scenarios;
    
    if (!query.trim()) return scenarios;
    
    const lowerQuery = query.toLowerCase();
    return scenarios.filter(scenario => 
      scenario.name.toLowerCase().includes(lowerQuery) ||
      scenario.description?.toLowerCase().includes(lowerQuery) ||
      scenario.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  },

  /**
   * Получить избранные сценарии
   * @param cityId - ID города
   * @returns Избранные сценарии
   */
  getFavoriteScenarios: async (cityId: number): Promise<Scenario[]> => {
    const response = await scenariosApi.listScenarios(cityId);
    return response.scenarios.filter(scenario => scenario.is_favorite);
  },

  /**
   * Добавить/удалить сценарий в избранное
   * @param cityId - ID города
   * @param scenarioId - ID сценария
   * @param isFavorite - Флаг избранного
   * @returns Обновлённый сценарий
   */
  toggleFavorite: async (cityId: number, scenarioId: string, isFavorite: boolean): Promise<Scenario> => {
    const response = await scenariosApi.updateScenario(cityId, scenarioId, { is_favorite: isFavorite });
    return response.scenario;
  },
};