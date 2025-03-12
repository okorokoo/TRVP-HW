import React, { useState, useEffect } from 'react';
import axios from 'axios';

const App = () => {
  const [masters, setMasters] = useState([]);
  const [newMasterName, setNewMasterName] = useState('');
  const [newApplication, setNewApplication] = useState({ address: '', complexity: 1 });
  const [transferState, setTransferState] = useState({ applicationId: null, fromMasterId: null });

  const fetchMasters = () => {
    console.log('Загружаем мастеров...');
    axios.get('http://localhost:5000/masters')
        .then(response => {
          setMasters(response.data);
        })
        .catch(error => console.error('Ошибка при загрузке данных мастеров', error));
  };
  

  useEffect(() => {
    // Загружаем список мастеров с их заявками
    fetchMasters();
    }, []);

  // Получение суммарной сложности для мастера
  const getMasterComplexity = (masterId) => {
    const master = masters.find(master => master.id === masterId);
    return master && master.applications 
      ? master.applications.reduce((sum, app) => sum + app.complexity, 0) 
      : 0; // Если нет заявок, возвращаем 0
  };

  // Добавление мастера
  const handleAddMaster = () => {
    if (newMasterName.trim() === '') return;
    axios.post('http://localhost:5000/masters', { name: newMasterName })
      .then(response => {
        setMasters([...masters, response.data]);
        setNewMasterName('');
        fetchMasters();
      })
      .catch(error => console.error('Ошибка при добавлении мастера', error));
  };

  // Удаление мастера
  const handleDeleteMaster = (masterId) => {
    axios.delete(`http://localhost:5000/masters/${masterId}`)
      .then(() => {
        setMasters(masters.filter(master => master.id !== masterId));
        fetchMasters();
      })
      .catch(error => console.error('Ошибка при удалении мастера', error));
  };

  // Редактирование мастера
  const handleEditMaster = (masterId, newName, newLimit) => {
    const master = masters.find(m => m.id === masterId);
    const updatedName = newName || master.name;  // Если имя не изменилось, оставляем старое
    const updatedLimit = (newLimit !== undefined && newLimit !== null) ? newLimit : master.maxComplexity;

    axios.put(`http://localhost:5000/masters/${masterId}`, { name: updatedName, max_complexity: updatedLimit })
      .then(response => {
        const updatedMasters = masters.map(master =>
          master.id === masterId ? { ...master, name: updatedName, maxComplexity: updatedLimit, isEditing: false } : master
        );
        setMasters(updatedMasters);
        fetchMasters();
      })
      .catch(error => console.error('Ошибка при редактировании мастера', error));
  };

  // Переключение режима редактирования для мастера
  const handleToggleEditMode = (masterId) => {
    const updatedMasters = masters.map(master =>
      master.id === masterId ? { ...master, isEditing: !master.isEditing } : master
    );
    setMasters(updatedMasters);
  };

  // Добавление заявки
  const handleAddApplication = (masterId) => {
    if (!newApplication.address.trim()) {
      alert('Адрес заявки не может быть пустым!');
      return;
    }

    const totalComplexity = getMasterComplexity(masterId);
    const master = masters.find(m => m.id === masterId);
    if (newApplication.complexity + totalComplexity > master.maxComplexity) {
      alert('Превышен лимит сложности для этого мастера!');
      return;
    }

    axios.post(`http://localhost:5000/masters/${masterId}/applications`, newApplication)
      .then(response => {
        const updatedMasters = masters.map(master => 
          master.id === masterId 
            ? { ...master, applications: [...master.applications, response.data] } 
            : master
        );
        setMasters(updatedMasters);  // Обновляем список мастеров с новыми заявками
        setNewApplication({ address: '', complexity: 1 }); // Сброс формы заявки
        fetchMasters();
      })
      .catch(error => console.error('Ошибка при добавлении заявки', error));
  };

  // Удаление заявки
  const handleDeleteApplication = (masterId, applicationId) => {
    axios.delete(`http://localhost:5000/masters/${masterId}/applications/${applicationId}`)
      .then(() => {
        const updatedMasters = masters.map(master => {
          if (master.id === masterId) {
            master.applications = master.applications.filter(app => app.id !== applicationId);
          }
          return master;
        });
        setMasters(updatedMasters);
        fetchMasters();
      })
      .catch(error => console.error('Ошибка при удалении заявки', error));
  };

  // Редактирование заявки
  const handleEditApplication = (masterId, applicationId, newAddress, newComplexity) => {
    const master = masters.find(m => m.id === masterId);

    // Получаем старую сложность заявки
    const oldComplexity = master.applications.find(app => app.id === applicationId).complexity;

    // Пересчитываем суммарную сложность без учета изменяемой заявки
    const totalComplexityWithoutApp = getMasterComplexity(masterId) - oldComplexity;

    // Проверяем, не превышает ли новая сложность лимит сложности мастера
    if (newComplexity + totalComplexityWithoutApp > master.maxComplexity) {
      alert('Превышен лимит сложности для этого мастера!');
      return;
    }

    axios.put(`http://localhost:5000/masters/${masterId}/applications/${applicationId}`, { address: newAddress, complexity: newComplexity })
      .then(response => {
        const updatedMasters = masters.map(master => {
          if (master.id === masterId) {
            master.applications = master.applications.map(app =>
              app.id === applicationId ? { ...app, address: newAddress, complexity: newComplexity, isEditing: false } : app
            );
          }
          return master;
        });
        setMasters(updatedMasters);  // Обновляем список заявок
        fetchMasters();
      })
      .catch(function(error) {
        console.error('Ошибка при редактировании заявки', error);
      })
  };

  //Перевод заявки
  const handleTransferApplication = async (fromMasterId, toMasterId, applicationId) => {
    const fromMaster = masters.find(master => master.id === fromMasterId);
    const application = fromMaster?.applications.find(app => app.id === applicationId);

    if (!application) {
      alert('Заявка не найдена!');
      return;
    }

    const toMaster = masters.find(master => master.id === toMasterId);

    if (!toMaster) {
      alert('Мастер для переноса заявки не найден!');
      return;
    }

    const totalComplexity = getMasterComplexity(toMasterId);

    if (application.complexity + totalComplexity > toMaster.maxComplexity) {
      alert('Превышен лимит сложности для этого мастера!');
      return;
    }

    try {
      // Добавляем заявку новому мастеру
      await axios.post(`http://localhost:5000/masters/${toMasterId}/applications`, {
        address: application.address,
        complexity: application.complexity,
      });

      // Удаляем заявку у старого мастера
      handleDeleteApplication(fromMasterId, applicationId);

      // Обновляем список мастеров в состоянии
      const updatedMasters = masters.map(master => {
        if (master.id === fromMasterId) {
          master.applications = master.applications.filter(app => app.id !== applicationId);
        }
        if (master.id === toMasterId) {
          master.applications = [...master.applications, application]; // Добавляем заявку новому мастеру
        }
        return master;
      });

      setMasters(updatedMasters); // Обновляем состояние мастеров
      setTransferState({ applicationId: null, fromMasterId: null }); // Очистить состояние выбора
    } catch (error) {
      console.error('Ошибка при переводе заявки', error);
    }
  };
  
  
  

  return (
    <div>
      <h1>Менеджер интернет-провайдера</h1>

      {/* Добавление мастера */}
      <div>
        <h2>Добавить мастера</h2>
        <input
          type="text"
          value={newMasterName}
          onChange={(e) => setNewMasterName(e.target.value)}
          placeholder="ФИО мастера"
        />
        <button onClick={() => handleAddMaster()}>Добавить</button>
      </div>

      {/* Список мастеров */}
      <div>
        <h2>Список мастеров</h2>
        {masters.length > 0 ? (
          masters.map(master => (
            <div key={master.id} style={{ border: '1px solid #ccc', marginBottom: '1rem', padding: '1rem' }}>
              <h3>
                {master.isEditing ? (
                  <>
                    <input
                      type="text"
                      placeholder="Редактировать имя"
                      value={master.editName || master.name}
                      onChange={(e) => {
                        const updatedMasters = masters.map(m =>
                          m.id === master.id ? { ...m, editName: e.target.value } : m
                        );
                        setMasters(updatedMasters);
                      }}
                    />
                    <input
                      type="number"
                      placeholder="Лимит сложности"
                      value={master.editMaxComplexity || master.maxComplexity}
                      onChange={(e) => {
                        const updatedMasters = masters.map(m =>
                          m.id === master.id ? { ...m, editMaxComplexity: parseInt(e.target.value) } : m
                        );
                        setMasters(updatedMasters);
                      }}
                    />
                    <button onClick={() => handleEditMaster(master.id, master.editName, master.editMaxComplexity)}>Сохранить</button>
                  </>
                ) : (
                  <>
                    {master.name} (ID: {master.id}) <br />
                    <strong>Сложность: {getMasterComplexity(master.id)} / {master.maxComplexity}</strong> <br />
                    <button onClick={() => handleDeleteMaster(master.id)}>Удалить</button>
                    <button onClick={() => handleToggleEditMode(master.id)}>Редактировать</button>
                  </>
                )}
              </h3>

              <h4>Заявки:</h4>
              <ul>
                {master.applications && master.applications.length > 0 ? (
                  master.applications.map(app => (
                    <li key={app.id} style={{ marginBottom: '0.5rem' }}>
                      {app.isEditing ? (
                        <>
                          <input
                            type="text"
                            value={app.editAddress || app.address}
                            onChange={(e) => {
                              const updatedMasters = masters.map(m =>
                                m.id === master.id ? {
                                  ...m,
                                  applications: m.applications.map(a =>
                                    a.id === app.id ? { ...a, editAddress: e.target.value } : a
                                  )
                                } : m
                              );
                              setMasters(updatedMasters);
                            }}
                          />
                          <input
                            type="number"
                            value={app.editComplexity || app.complexity}
                            onChange={(e) => {
                              const updatedMasters = masters.map(m =>
                                m.id === master.id ? {
                                  ...m,
                                  applications: m.applications.map(a =>
                                    a.id === app.id ? { ...a, editComplexity: parseInt(e.target.value) } : a
                                  )
                                } : m
                              );
                              setMasters(updatedMasters);
                            }}
                          />
                          <button onClick={() => handleEditApplication(master.id, app.id, app.editAddress, app.editComplexity)}>Сохранить</button>
                        </>
                      ) : (
                        <>
                          {app.address} (Сложность: {app.complexity})
                          <button onClick={() => handleDeleteApplication(master.id, app.id)}>Удалить</button>

                          {/* Кнопка для открытия формы выбора мастера */}
                          <button onClick={() => setTransferState({ applicationId: app.id, fromMasterId: master.id })}>
                            Перевести
                          </button>

                          <button onClick={() => {
                            const updatedMasters = masters.map(m =>
                              m.id === master.id ? {
                                ...m,
                                applications: m.applications.map(a =>
                                  a.id === app.id ? { ...a, isEditing: true } : a
                                )
                              } : m
                            );
                            setMasters(updatedMasters);
                          }}>Редактировать заявку</button>
                        </>
                      )}

                      {/* Выпадающий список выбора мастера */}
                      {transferState.applicationId === app.id && transferState.fromMasterId === master.id && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <select
                            defaultValue=""
                            onChange={(e) => {
                              const toMasterId = parseInt(e.target.value);
                              if (!toMasterId) return;

                              const toMaster = masters.find(m => m.id === toMasterId);
                              const totalComplexity = getMasterComplexity(toMasterId);

                              if (app.complexity + totalComplexity > toMaster.maxComplexity) {
                                alert('Нельзя перевести заявку: превышен лимит сложности у выбранного мастера!');
                                return;
                              }

                              handleTransferApplication(master.id, toMasterId, app.id);
                            }}
                          >
                            <option value="">Выберите мастера</option>
                            {masters
                              .filter(m => m.id !== master.id)
                              .map(m => {
                                const currentComplexity = getMasterComplexity(m.id);
                                const futureComplexity = currentComplexity + app.complexity;
                                const canTransfer = futureComplexity <= m.maxComplexity;

                                return (
                                  <option
                                    key={m.id}
                                    value={m.id}
                                    disabled={!canTransfer}
                                  >
                                    {m.name} (сложность: {currentComplexity}/{m.maxComplexity})
                                  </option>
                                );
                              })}
                          </select>

                          <button onClick={() => setTransferState({ applicationId: null, fromMasterId: null })}>
                            Отмена
                          </button>
                        </div>
                      )}
                    </li>
                  ))
                ) : (
                  <p>Нет заявок для этого мастера</p>
                )}
              </ul>

              {/* Добавление заявки */}
              <input
                type="text"
                value={newApplication.address}
                onChange={(e) => setNewApplication({ ...newApplication, address: e.target.value })}
                placeholder="Адрес"
              />
              <input
                type="number"
                value={newApplication.complexity}
                onChange={(e) => setNewApplication({ ...newApplication, complexity: parseInt(e.target.value) })}
                placeholder="Сложность"
              />
              <button onClick={() => handleAddApplication(master.id)}>Добавить заявку</button>
            </div>
          ))
        ) : (
          <p>Нет мастеров для отображения</p>
        )}
      </div>
    </div>
  );
};

export default App;
