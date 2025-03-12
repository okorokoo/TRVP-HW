const express = require('express');
const { Client } = require('pg'); // Импортируем клиент для PostgreSQL
const cors = require('cors');

// Создаем приложение Express
const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

// Подключение к базе данных PostgreSQL
const client = new Client({
  host: 'localhost',
  port: 5432, 
  user: 'postgres', 
  password: 'postgres', 
  database: 'provider_management' 
});

client.connect((err) => {
  if (err) {
    console.error('Ошибка подключения к базе данных:', err);
    return;
  }
  console.log('Подключение к базе данных успешно!');
});

app.get('/masters', (req, res) => {
    const sql = `
      SELECT m.id AS master_id, m.name AS master_name, 
             m.max_complexity, 
             a.id AS application_id, a.address, a.complexity
      FROM masters m
      LEFT JOIN applications a ON m.id = a.master_id
      GROUP BY m.id, a.id
    `;
  
    client.query(sql, (err, result) => {
      if (err) {
        console.error('Ошибка при получении данных мастеров:', err);
        return res.status(500).json({ error: 'Ошибка при получении данных' });
      }
  
      // Группируем заявки по мастерам
      const masters = result.rows.reduce((acc, row) => {
        const { master_id, master_name, max_complexity, application_id, address, complexity } = row;
  
        let master = acc.find(m => m.id === master_id);
        if (!master) {
          master = {
            id: master_id,
            name: master_name,
            max_complexity: max_complexity,
            applications: [],
          };
          acc.push(master);
        }
  
        // Добавляем заявку, если она существует
        if (application_id) {
          master.applications.push({ id: application_id, address, complexity: complexity || 0 });  // Применяем дефолтное значение 0 для сложности
        }
  
        return acc;
      }, []);
  
      // Отправляем мастеров с заявками
      res.json(masters.map(master => ({
        id: master.id,
        name: master.name,
        maxComplexity: master.max_complexity,
        applications: master.applications,
      })));
    });
  });
  
  

// Добавление мастера
app.post('/masters', (req, res) => {
  const { name } = req.body;
  const sql = 'INSERT INTO masters (name, max_complexity) VALUES ($1, $2) RETURNING id, name, max_complexity';
  client.query(sql, [name, 10], (err, result) => {  // Примерная сложность по умолчанию
    if (err) {
      res.status(500).json({ error: 'Ошибка добавления мастера' });
      return;
    }
    res.status(201).json(result.rows[0]);
  });
});

// Добавление заявки
app.post('/masters/:masterId/applications', (req, res) => {
  const masterId = req.params.masterId;
  const { address, complexity } = req.body;

  const sqlInsertApplication = 'INSERT INTO applications (master_id, address, complexity) VALUES ($1, $2, $3) RETURNING id, address, complexity';

  client.query(sqlInsertApplication, [masterId, address, complexity], (err, result) => {
    if (err) {
      res.status(500).json({ error: 'Ошибка при добавлении заявки' });
      return;
    }

    // Возвращаем успешный статус и данные о добавленной заявке
    const { id, address, complexity } = result.rows[0];
    res.status(201).json({
      message: 'Заявка успешно добавлена.',
      application: {
        id,
        address,
        complexity,
      },
    });
  });
});


// Удаление заявки
app.delete('/masters/:masterId/applications/:applicationId', (req, res) => {
  const { masterId, applicationId } = req.params;
  const sql = 'DELETE FROM applications WHERE id = $1 AND master_id = $2 RETURNING id, complexity';

  client.query(sql, [applicationId, masterId], (err, result) => {
    if (err) {
      console.error('Ошибка при удалении заявки:', err);
      return res.status(500).json({ error: 'Ошибка при удалении заявки' });
    }

    if (result.rows.length === 0) {
      console.warn('Заявка не найдена для удаления');
      return res.status(404).json({ error: 'Заявка не найдена' });
    }

    // Получаем информацию о удаленной заявке
    const { id, complexity } = result.rows[0];

    // Возвращаем успешный статус с информацией о удаленной заявке
    res.status(200).json({
      message: `Заявка с ID ${id} успешно удалена.`,
      complexity: complexity,
    });
  });
});



// Редактирование заявки
app.put('/masters/:masterId/applications/:applicationId', (req, res) => {
  const { masterId, applicationId } = req.params;
  const { address, complexity } = req.body;

  const sql = 'UPDATE applications SET address = $1, complexity = $2 WHERE id = $3 AND master_id = $4 RETURNING id, address, complexity';
  client.query(sql, [address, complexity, applicationId, masterId], (err, result) => {
    if (err) {
      res.status(500).json({ error: 'Ошибка при редактировании заявки' });
      return;
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }

    // Возвращаем успешный статус с обновленными данными заявки
    const { id, address, complexity } = result.rows[0];
    res.status(200).json({
      message: 'Заявка успешно обновлена.',
      application: {
        id,
        address,
        complexity,
      },
    });
  });
});


// Редактирование мастера
app.put('/masters/:masterId', (req, res) => {
  const { masterId } = req.params;
  const { name, max_complexity } = req.body;  // Только max_complexity и name могут быть обновлены

  const sql = 'UPDATE masters SET name = $1, max_complexity = $2 WHERE id = $3 RETURNING id, name, max_complexity';
  client.query(sql, [name, max_complexity, masterId], (err, result) => {
    if (err) {
      res.status(500).json({ error: 'Ошибка при редактировании мастера' });
      return;
    }

    res.status(200).json(result.rows[0]); // Отправляем обновленные данные мастера
  });
});

// Удаление мастера
app.delete('/masters/:masterId', (req, res) => {
  const { masterId } = req.params;

  // Сначала удалим все заявки, связанные с мастером
  const deleteApplicationsQuery = 'DELETE FROM applications WHERE master_id = $1';
  client.query(deleteApplicationsQuery, [masterId], (err) => {
    if (err) {
      console.error('Ошибка при удалении заявок мастера:', err);
      return res.status(500).json({ error: 'Ошибка при удалении заявок мастера' });
    }

    // Теперь удалим самого мастера
    const deleteMasterQuery = 'DELETE FROM masters WHERE id = $1 RETURNING id';
    client.query(deleteMasterQuery, [masterId], (err, result) => {
      if (err) {
        console.error('Ошибка при удалении мастера:', err);
        return res.status(500).json({ error: 'Ошибка при удалении мастера' });
      }

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Мастер не найден' });
      }

      res.status(200).json({ message: `Мастер с id ${masterId} успешно удален` });
    });
  });
});


// Запуск сервера
app.listen(port, () => {
  console.log(`Сервер запущен на http://localhost:${port}`);
});
