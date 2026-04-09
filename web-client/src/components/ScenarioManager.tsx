import React, { useState, useEffect } from 'react';
import { Save, FolderOpen, Trash2, Copy, Star, StarOff, X, Search, Clock, User } from 'lucide-react';
import { scenariosApi, type Scenario } from '../api/scenariosApi';
import type { Modification } from '../pages/SimulationPage';

interface ScenarioManagerProps {
  cityId: number;
  currentModifications: Modification[];
  onLoadScenario: (modifications: Modification[]) => void;
  onScenarioSaved?: () => void;
  disabled?: boolean;
}

const ScenarioManager: React.FC<ScenarioManagerProps> = ({
  cityId,
  currentModifications,
  onLoadScenario,
  onScenarioSaved,
  disabled = false
}) => {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [scenarioName, setScenarioName] = useState('');
  const [scenarioDescription, setScenarioDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);

  // Загрузка списка сценариев
  const loadScenarios = async () => {
    try {
      const response = await scenariosApi.listScenarios(cityId);
      setScenarios(response.scenarios);
    } catch (error) {
      console.error('Ошибка загрузки сценариев:', error);
    }
  };

  // Сохранение сценария
  const saveScenario = async () => {
    if (!scenarioName.trim()) {
      alert('Введите название сценария');
      return;
    }

    setIsLoading(true);
    try {
      await scenariosApi.saveCurrentModifications(
        cityId,
        scenarioName,
        currentModifications.filter(m => m.enabled),
        scenarioDescription
      );

      await loadScenarios();
      setShowSaveModal(false);
      setScenarioName('');
      setScenarioDescription('');
      onScenarioSaved?.();
      alert(`✅ Сценарий "${scenarioName}" сохранён!`);
    } catch (error) {
      console.error('Ошибка сохранения сценария:', error);
      alert('❌ Ошибка сохранения сценария');
    } finally {
      setIsLoading(false);
    }
  };

  // Загрузка сценария
  const loadScenario = async (scenarioId: string) => {
    setIsLoading(true);
    try {
      const modifications = await scenariosApi.loadScenarioModifications(cityId, scenarioId);
      onLoadScenario(modifications);
      setShowLoadModal(false);
      alert(`✅ Сценарий загружен`);
    } catch (error) {
      console.error('Ошибка загрузки сценария:', error);
      alert('❌ Ошибка загрузки сценария');
    } finally {
      setIsLoading(false);
    }
  };

  // Удаление сценария
  const deleteScenario = async (scenarioId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!confirm('Удалить сценарий?')) return;

    try {
      await scenariosApi.deleteScenario(cityId, scenarioId);
      await loadScenarios();
      alert('✅ Сценарий удалён');
    } catch (error) {
      console.error('Ошибка удаления сценария:', error);
      alert('❌ Ошибка удаления сценария');
    }
  };

  // Копирование сценария
  const duplicateScenario = async (scenarioId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const newName = prompt('Введите название для копии:');
    if (!newName) return;

    try {
      await scenariosApi.duplicateScenario(cityId, scenarioId, { new_name: newName });
      await loadScenarios();
      alert(`✅ Сценарий скопирован как "${newName}"`);
    } catch (error) {
      console.error('Ошибка копирования сценария:', error);
      alert('❌ Ошибка копирования сценария');
    }
  };

  // Переключение избранного
  const toggleFavorite = async (scenario: Scenario, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await scenariosApi.toggleFavorite(cityId, scenario.id, !scenario.is_favorite);
      await loadScenarios();
    } catch (error) {
      console.error('Ошибка изменения избранного:', error);
    }
  };

  // Форматирование даты
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Получение иконки для типа модификации
  const getModificationIcon = (type: string): string => {
    switch (type) {
      case 'close_stop': return '🚫';
      case 'add_stop': return '➕';
      case 'add_route': return '🛤️';
      case 'delete_route': return '🗑️';
      case 'change_interval': return '⏱️';
      case 'change_capacity': return '📦';
      default: return '📌';
    }
  };

  // Получение цвета для типа модификации
  const getModificationColor = (type: string): string => {
    switch (type) {
      case 'close_stop': return '#ef4444';
      case 'add_stop': return '#10b981';
      case 'add_route': return '#3b82f6';
      case 'delete_route': return '#dc2626';
      case 'change_interval': return '#f59e0b';
      case 'change_capacity': return '#8b5cf6';
      default: return '#64748b';
    }
  };

  // Фильтрация сценариев
  const filteredScenarios = scenarios.filter(scenario =>
    scenario.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    scenario.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Избранные сценарии
  const favoriteScenarios = filteredScenarios.filter(s => s.is_favorite);
  const otherScenarios = filteredScenarios.filter(s => !s.is_favorite);

  return (
    <>
      {/* Кнопки управления сценариями */}
      <div className="scenario-actions">
        <button
          className="action-btn secondary"
          onClick={() => setShowSaveModal(true)}
          disabled={disabled || currentModifications.length === 0}
          title="Сохранить текущие изменения как сценарий"
        >
          <Save size={16} />
          Сохранить сценарий
        </button>

        <button
          className="action-btn secondary"
          onClick={() => {
            loadScenarios();
            setShowLoadModal(true);
          }}
          disabled={disabled}
          title="Загрузить сохранённый сценарий"
        >
          <FolderOpen size={16} />
          Загрузить сценарий
        </button>
      </div>

      {/* Модальное окно сохранения сценария */}
      {showSaveModal && (
        <div className="modal-overlay" onClick={() => setShowSaveModal(false)}>
          <div className="modal-content save-scenario-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>💾 Сохранение сценария</h3>
              <button className="close-btn" onClick={() => setShowSaveModal(false)}>✕</button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Название сценария *</label>
                <input
                  type="text"
                  placeholder="например: Закрытие центра в час пик"
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Описание (необязательно)</label>
                <textarea
                  placeholder="Что изменится? Какая цель?"
                  value={scenarioDescription}
                  onChange={(e) => setScenarioDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="scenario-preview">
                <div className="preview-title">
                  Изменения ({currentModifications.filter(m => m.enabled).length})
                </div>
                <div className="preview-list">
                  {currentModifications.filter(m => m.enabled).slice(0, 5).map(mod => (
                    <div 
                      key={mod.id} 
                      className="preview-item"
                      style={{ borderLeftColor: getModificationColor(mod.type) }}
                    >
                      <span className="preview-icon">{getModificationIcon(mod.type)}</span>
                      <span className="preview-text">{mod.label || `${mod.type} #${mod.targetId}`}</span>
                    </div>
                  ))}
                  {currentModifications.filter(m => m.enabled).length > 5 && (
                    <div className="preview-more">
                      + ещё {currentModifications.filter(m => m.enabled).length - 5}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="action-btn secondary" onClick={() => setShowSaveModal(false)}>
                Отмена
              </button>
              <button className="action-btn primary" onClick={saveScenario} disabled={isLoading || !scenarioName.trim()}>
                {isLoading ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно загрузки сценария */}
      {showLoadModal && (
        <div className="modal-overlay" onClick={() => setShowLoadModal(false)}>
          <div className="modal-content load-scenario-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📂 Загрузка сценария</h3>
              <button className="close-btn" onClick={() => setShowLoadModal(false)}>✕</button>
            </div>

            <div className="modal-body">
              <div className="search-box">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Поиск по названию или описанию..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button className="clear-search" onClick={() => setSearchQuery('')}>✕</button>
                )}
              </div>

              {isLoading ? (
                <div className="loading-spinner">Загрузка...</div>
              ) : filteredScenarios.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📭</div>
                  <p>Нет сохранённых сценариев</p>
                  <p className="empty-hint">Создайте первый сценарий, нажав «Сохранить»</p>
                </div>
              ) : (
                <div className="scenarios-list">
                  {/* Избранные сценарии */}
                  {favoriteScenarios.length > 0 && (
                    <div className="scenarios-group">
                      <div className="group-title">
                        <Star size={14} /> Избранные
                      </div>
                      {favoriteScenarios.map(scenario => (
                        <div
                          key={scenario.id}
                          className={`scenario-item ${selectedScenario?.id === scenario.id ? 'selected' : ''}`}
                          onClick={() => setSelectedScenario(scenario)}
                          onDoubleClick={() => loadScenario(scenario.id)}
                        >
                          <div className="scenario-info">
                            <div className="scenario-name">{scenario.name}</div>
                            {scenario.description && (
                              <div className="scenario-description">{scenario.description}</div>
                            )}
                            <div className="scenario-meta">
                              <span><Clock size={12} /> {formatDate(scenario.created_at)}</span>
                              {scenario.version && <span>v{scenario.version}</span>}
                              <span>Изменений: {scenario.modifications?.length || 0}</span>
                            </div>
                            {/* Превью изменений в сценарии */}
                            {scenario.modifications && scenario.modifications.length > 0 && (
                              <div className="scenario-modifications-preview">
                                {scenario.modifications.slice(0, 3).map(mod => (
                                  <span key={mod.id} className="mod-preview-badge">
                                    {getModificationIcon(mod.type)} {mod.type === 'delete_route' ? 'Удалить маршрут' : mod.label?.slice(0, 20)}
                                  </span>
                                ))}
                                {scenario.modifications.length > 3 && (
                                  <span className="mod-preview-more">+{scenario.modifications.length - 3}</span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="scenario-actions">
                            <button
                              className="icon-btn favorite"
                              onClick={(e) => toggleFavorite(scenario, e)}
                              title="Убрать из избранного"
                            >
                              <Star size={16} fill="currentColor" />
                            </button>
                            <button
                              className="icon-btn copy"
                              onClick={(e) => duplicateScenario(scenario.id, e)}
                              title="Копировать"
                            >
                              <Copy size={16} />
                            </button>
                            <button
                              className="icon-btn delete"
                              onClick={(e) => deleteScenario(scenario.id, e)}
                              title="Удалить"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Остальные сценарии */}
                  {otherScenarios.length > 0 && (
                    <div className="scenarios-group">
                      <div className="group-title">
                        Все сценарии
                      </div>
                      {otherScenarios.map(scenario => (
                        <div
                          key={scenario.id}
                          className={`scenario-item ${selectedScenario?.id === scenario.id ? 'selected' : ''}`}
                          onClick={() => setSelectedScenario(scenario)}
                          onDoubleClick={() => loadScenario(scenario.id)}
                        >
                          <div className="scenario-info">
                            <div className="scenario-name">{scenario.name}</div>
                            {scenario.description && (
                              <div className="scenario-description">{scenario.description}</div>
                            )}
                            <div className="scenario-meta">
                              <span><Clock size={12} /> {formatDate(scenario.created_at)}</span>
                              {scenario.version && <span>v{scenario.version}</span>}
                              <span>Изменений: {scenario.modifications?.length || 0}</span>
                            </div>
                            {/* Превью изменений в сценарии */}
                            {scenario.modifications && scenario.modifications.length > 0 && (
                              <div className="scenario-modifications-preview">
                                {scenario.modifications.slice(0, 3).map(mod => (
                                  <span key={mod.id} className="mod-preview-badge">
                                    {getModificationIcon(mod.type)} {mod.type === 'delete_route' ? '🗑️ Удалить' : mod.label?.slice(0, 15)}
                                  </span>
                                ))}
                                {scenario.modifications.length > 3 && (
                                  <span className="mod-preview-more">+{scenario.modifications.length - 3}</span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="scenario-actions">
                            <button
                              className="icon-btn favorite"
                              onClick={(e) => toggleFavorite(scenario, e)}
                              title="Добавить в избранное"
                            >
                              <StarOff size={16} />
                            </button>
                            <button
                              className="icon-btn copy"
                              onClick={(e) => duplicateScenario(scenario.id, e)}
                              title="Копировать"
                            >
                              <Copy size={16} />
                            </button>
                            <button
                              className="icon-btn delete"
                              onClick={(e) => deleteScenario(scenario.id, e)}
                              title="Удалить"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="action-btn secondary" onClick={() => setShowLoadModal(false)}>
                Отмена
              </button>
              <button
                className="action-btn primary"
                onClick={() => selectedScenario && loadScenario(selectedScenario.id)}
                disabled={!selectedScenario}
              >
                Загрузить выбранный
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ScenarioManager;