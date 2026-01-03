import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import Card from '../components/Card';
import { Input, Select } from '../components/Input';
import { api } from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import './Dashboard.css';

interface DashboardData {
  currency: string;
  total_spent: string;
  total_paid_to_others: string;
  total_received: string;
  recent_expenses: any[];
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    project_ids: '',
    start_date: '',
    end_date: '',
  });
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [filters]);

  const loadProjects = async () => {
    try {
      const response = await api.getProjects();
      setProjects(response.data);
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filters.project_ids) params.project_ids = filters.project_ids;
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;

      const response = await api.getDashboard(params);
      setData(response.data);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const chartData = data
    ? [
        { name: 'Spent', value: parseFloat(data.total_spent) },
        { name: 'Paid to Others', value: parseFloat(data.total_paid_to_others) },
        { name: 'Received', value: parseFloat(data.total_received) },
      ].filter(item => item.value > 0)
    : [];

  const COLORS = ['#4a90e2', '#50c878', '#f39c12'];

  if (loading && !data) {
    return (
      <Layout>
        <div className="loading">Loading dashboard...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="dashboard">
        <h1>Dashboard</h1>

        <Card title="Filters">
          <div className="filters-grid">
            <Select
              label="Project"
              options={[
                { value: '', label: 'All Projects' },
                ...projects.map(p => ({ value: p.id, label: p.name })),
              ]}
              value={filters.project_ids}
              onChange={(e) => setFilters({ ...filters, project_ids: e.target.value })}
            />
            <Input
              type="date"
              label="Start Date"
              value={filters.start_date}
              onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
            />
            <Input
              type="date"
              label="End Date"
              value={filters.end_date}
              onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
            />
          </div>
        </Card>

        <div className="stats-grid">
          <Card>
            <div className="stat-item">
              <div className="stat-label">Total Spent</div>
              <div className="stat-value">
                {data?.currency} {data?.total_spent || '0.00'}
              </div>
            </div>
          </Card>
          <Card>
            <div className="stat-item">
              <div className="stat-label">Paid to Others</div>
              <div className="stat-value">
                {data?.currency} {data?.total_paid_to_others || '0.00'}
              </div>
            </div>
          </Card>
          <Card>
            <div className="stat-item">
              <div className="stat-label">Received</div>
              <div className="stat-value">
                {data?.currency} {data?.total_received || '0.00'}
              </div>
            </div>
          </Card>
        </div>

        {chartData.length > 0 && (
          <Card title="Summary Chart">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}

        <Card title="Recent Expenses">
          {data?.recent_expenses && data.recent_expenses.length > 0 ? (
            <div className="expenses-list">
              {data.recent_expenses.map((expense) => (
                <div key={expense.id} className="expense-item">
                  <div className="expense-info">
                    <div className="expense-name">{expense.name}</div>
                    <div className="expense-project">{expense.project_name}</div>
                    <div className="expense-date">{new Date(expense.date).toLocaleDateString()}</div>
                  </div>
                  <div className="expense-amount">
                    {expense.currency} {parseFloat(expense.amount).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>No expenses found.</p>
          )}
        </Card>
      </div>
    </Layout>
  );
}

