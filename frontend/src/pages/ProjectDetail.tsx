import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import Card from '../components/Card';
import Button from '../components/Button';
import { Input, Select, Textarea } from '../components/Input';
import { api } from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import './ProjectDetail.css';

const PAYMENT_MODES = [
  { value: '', label: 'Select payment mode' },
  { value: 'cash', label: 'Cash' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'debit_card', label: 'Debit Card' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'other', label: 'Other' },
];

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [paymentSummary, setPaymentSummary] = useState<any[]>([]);
  const [paymentTransactions, setPaymentTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [newExpense, setNewExpense] = useState({
    name: '',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    paid_to: '',
    payment_mode: '',
    receipt: null as File | null,
    splits: [] as any[],
  });
  const [newPayment, setNewPayment] = useState({
    to_user_id: '',
    amount: '',
    details: '',
    receipt: null as File | null,
  });

  useEffect(() => {
    if (id) {
      loadProject();
      loadExpenses();
      loadPaymentSummary();
      loadPaymentTransactions();
    }
  }, [id]);

  useEffect(() => {
    if (userSearch.length >= 2) {
      searchUsers();
    } else {
      setAvailableUsers([]);
    }
  }, [userSearch]);

  const loadProject = async () => {
    try {
      const response = await api.getProject(id!);
      setProject(response.data);
    } catch (err) {
      console.error('Failed to load project:', err);
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  };

  const loadExpenses = async () => {
    try {
      const response = await api.getExpenses(id!);
      setExpenses(response.data);
    } catch (err) {
      console.error('Failed to load expenses:', err);
    }
  };

  const loadPaymentSummary = async () => {
    try {
      const response = await api.getPaymentSummary(id!);
      setPaymentSummary(response.data);
    } catch (err) {
      console.error('Failed to load payment summary:', err);
    }
  };

  const loadPaymentTransactions = async () => {
    try {
      const response = await api.getPaymentTransactions(id!);
      setPaymentTransactions(response.data);
    } catch (err) {
      console.error('Failed to load payment transactions:', err);
    }
  };

  const searchUsers = async () => {
    try {
      const response = await api.searchUsers(userSearch);
      setAvailableUsers(response.data);
    } catch (err) {
      console.error('Failed to search users:', err);
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('project_id', id!);
      formData.append('name', newExpense.name);
      formData.append('description', newExpense.description);
      formData.append('amount', newExpense.amount);
      formData.append('date', newExpense.date);
      formData.append('paid_to', newExpense.paid_to);
      formData.append('payment_mode', newExpense.payment_mode);
      formData.append('splits', JSON.stringify(newExpense.splits));
      if (newExpense.receipt) {
        formData.append('receipt', newExpense.receipt);
      }

      await api.createExpense(formData);
      setShowExpenseModal(false);
      setNewExpense({
        name: '',
        description: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        paid_to: '',
        payment_mode: '',
        receipt: null,
        splits: [],
      });
      loadExpenses();
      loadPaymentSummary();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create expense');
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const userId = (e.target as any).user_id.value;
    const role = (e.target as any).role.value;
    try {
      await api.addProjectMember(id!, userId, role);
      setShowAddMemberModal(false);
      setUserSearch('');
      loadProject();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add member');
    }
  };

  const handleMakePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('project_id', id!);
      formData.append('to_user_id', newPayment.to_user_id);
      formData.append('amount', newPayment.amount);
      formData.append('details', newPayment.details);
      if (newPayment.receipt) {
        formData.append('receipt', newPayment.receipt);
      }

      await api.makePayment(formData);
      setShowPaymentModal(false);
      setNewPayment({ to_user_id: '', amount: '', details: '', receipt: null });
      loadPaymentTransactions();
      loadPaymentSummary();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create payment');
    }
  };

  const handleUpdatePaymentStatus = async (paymentId: string, status: string) => {
    try {
      await api.updatePaymentStatus(paymentId, status);
      loadPaymentTransactions();
      loadPaymentSummary();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update payment status');
    }
  };

  const updateExpenseSplits = () => {
    if (!project) return;
    const members = project.members || [];
    const amount = parseFloat(newExpense.amount) || 0;
    const equalShare = amount / members.length;

    setNewExpense({
      ...newExpense,
      splits: members.map((member: any) => ({
        user_id: member.id,
        amount: equalShare.toFixed(2),
        percentage: (100 / members.length).toFixed(2),
      })),
    });
  };

  useEffect(() => {
    if (newExpense.amount && project) {
      updateExpenseSplits();
    }
  }, [newExpense.amount, project]);

  if (loading) {
    return (
      <Layout>
        <div className="loading">Loading project...</div>
      </Layout>
    );
  }

  if (!project) {
    return null;
  }

  const canEdit = project.userRole === 'owner' || project.userRole === 'editor';
  const paymentChartData = paymentSummary.map((item) => ({
    name: item.user.email,
    value: parseFloat(item.total_paid),
  }));

  return (
    <Layout>
      <div className="project-detail">
        <div className="page-header">
          <div>
            <h1>{project.name}</h1>
            <div className="project-dates">
              {project.start_date && (
                <span>Start: {new Date(project.start_date).toLocaleDateString()}</span>
              )}
              {project.end_date && (
                <span>End: {new Date(project.end_date).toLocaleDateString()}</span>
              )}
            </div>
          </div>
          {canEdit && (
            <Button onClick={() => setShowExpenseModal(true)}>Add Expense</Button>
          )}
        </div>

        <Card title="Members">
          <div className="members-list">
            {project.members?.map((member: any) => (
              <div key={member.id} className="member-item">
                <div>
                  <div className="member-email">{member.email}</div>
                  <div className="member-role">{member.role}</div>
                </div>
              </div>
            ))}
            {canEdit && (
              <Button variant="secondary" size="sm" onClick={() => setShowAddMemberModal(true)}>
                Add Member
              </Button>
            )}
          </div>
        </Card>

        <Card title="Expenses">
          {expenses.length === 0 ? (
            <p>No expenses yet.</p>
          ) : (
            <div className="expenses-list">
              {expenses.map((expense) => (
                <div key={expense.id} className="expense-item">
                  <div className="expense-info">
                    <div className="expense-name">{expense.name}</div>
                    {expense.description && (
                      <div className="expense-description">{expense.description}</div>
                    )}
                    <div className="expense-meta">
                      <span>{new Date(expense.date).toLocaleDateString()}</span>
                      {expense.paid_to && <span>Paid to: {expense.paid_to}</span>}
                      {expense.payment_mode && <span>{expense.payment_mode}</span>}
                    </div>
                    <div className="expense-splits">
                      <strong>Splits:</strong>
                      {expense.splits?.map((split: any) => (
                        <span key={split.id}>
                          {split.user_email}: {expense.currency} {parseFloat(split.amount).toFixed(2)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="expense-amount">
                    {expense.currency} {parseFloat(expense.amount).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="summary-section">
          <Card title="Payment Summary">
            {paymentChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={paymentChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {paymentChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#4a90e2', '#50c878', '#f39c12', '#e74c3c'][index % 4]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p>No payment data yet.</p>
            )}
            <div className="payment-summary-list">
              {paymentSummary.map((item) => (
                <div key={item.user.id} className="summary-item">
                  <div>{item.user.email}</div>
                  <div>Paid: {project.default_currency} {item.total_paid}</div>
                  <div>Owed: {project.default_currency} {item.total_owed}</div>
                  <div>Net: {project.default_currency} {item.net}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Receivables & Payments">
            <Button onClick={() => setShowPaymentModal(true)}>Make Payment</Button>
            <div className="transactions-list">
              {paymentTransactions.map((transaction) => (
                <div key={transaction.id} className="transaction-item">
                  <div>
                    <div>
                      {transaction.from_user_email} → {transaction.to_user_email}
                    </div>
                    <div className="transaction-amount">
                      {project.default_currency} {parseFloat(transaction.amount).toFixed(2)}
                    </div>
                    <div className="transaction-status">{transaction.status}</div>
                    {transaction.details && <div>{transaction.details}</div>}
                  </div>
                  {transaction.to_user_id === user?.id &&
                    transaction.status === 'pending' && (
                      <div className="transaction-actions">
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => handleUpdatePaymentStatus(transaction.id, 'confirmed')}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleUpdatePaymentStatus(transaction.id, 'rejected')}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Expense Modal */}
        {showExpenseModal && (
          <div className="modal-overlay" onClick={() => setShowExpenseModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>Add Expense</h2>
              <form onSubmit={handleCreateExpense}>
                <Input
                  label="Expense Name"
                  value={newExpense.name}
                  onChange={(e) => setNewExpense({ ...newExpense, name: e.target.value })}
                  required
                />
                <Textarea
                  label="Description (Optional)"
                  value={newExpense.description}
                  onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                />
                <Input
                  type="number"
                  step="0.01"
                  label="Amount"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                  required
                />
                <Input
                  type="date"
                  label="Date"
                  value={newExpense.date}
                  onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                  required
                />
                <Input
                  label="Paid To (Optional)"
                  value={newExpense.paid_to}
                  onChange={(e) => setNewExpense({ ...newExpense, paid_to: e.target.value })}
                />
                <Select
                  label="Payment Mode (Optional)"
                  options={PAYMENT_MODES}
                  value={newExpense.payment_mode}
                  onChange={(e) => setNewExpense({ ...newExpense, payment_mode: e.target.value })}
                />
                <Input
                  type="file"
                  label="Receipt (Optional)"
                  accept="image/*,application/pdf"
                  onChange={(e) =>
                    setNewExpense({ ...newExpense, receipt: e.target.files?.[0] || null })
                  }
                />
                <div className="splits-section">
                  <label>Splits:</label>
                  {newExpense.splits.map((split, index) => {
                    const member = project.members?.find((m: any) => m.id === split.user_id);
                    return (
                      <div key={index} className="split-item">
                        <span>{member?.email}</span>
                        <Input
                          type="number"
                          step="0.01"
                          value={split.amount}
                          onChange={(e) => {
                            const updated = [...newExpense.splits];
                            updated[index].amount = e.target.value;
                            updated[index].percentage = (
                              (parseFloat(e.target.value) / parseFloat(newExpense.amount || '1')) *
                              100
                            ).toFixed(2);
                            setNewExpense({ ...newExpense, splits: updated });
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="modal-actions">
                  <Button type="button" variant="secondary" onClick={() => setShowExpenseModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create Expense</Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && (
          <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>Make Payment</h2>
              <form onSubmit={handleMakePayment}>
                <Select
                  label="Pay To"
                  options={[
                    { value: '', label: 'Select user' },
                    ...(project.members || [])
                      .filter((m: any) => m.id !== user?.id)
                      .map((m: any) => ({ value: m.id, label: m.email })),
                  ]}
                  value={newPayment.to_user_id}
                  onChange={(e) => setNewPayment({ ...newPayment, to_user_id: e.target.value })}
                  required
                />
                <Input
                  type="number"
                  step="0.01"
                  label="Amount"
                  value={newPayment.amount}
                  onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                  required
                />
                <Textarea
                  label="Details (Optional)"
                  value={newPayment.details}
                  onChange={(e) => setNewPayment({ ...newPayment, details: e.target.value })}
                />
                <Input
                  type="file"
                  label="Receipt (Optional)"
                  accept="image/*,application/pdf"
                  onChange={(e) =>
                    setNewPayment({ ...newPayment, receipt: e.target.files?.[0] || null })
                  }
                />
                <div className="modal-actions">
                  <Button type="button" variant="secondary" onClick={() => setShowPaymentModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Make Payment</Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Member Modal */}
        {showAddMemberModal && (
          <div className="modal-overlay" onClick={() => setShowAddMemberModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>Add Member</h2>
              <form onSubmit={handleAddMember}>
                <Input
                  label="Search User by Email"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Type email to search..."
                />
                {availableUsers.length > 0 && (
                  <Select
                    label="Select User"
                    name="user_id"
                    options={[
                      { value: '', label: 'Select user' },
                      ...availableUsers.map((u) => ({ value: u.id, label: u.email })),
                    ]}
                    required
                  />
                )}
                <Select
                  label="Role"
                  name="role"
                  options={[
                    { value: 'editor', label: 'Editor' },
                    { value: 'viewer', label: 'Viewer' },
                  ]}
                  required
                />
                <div className="modal-actions">
                  <Button type="button" variant="secondary" onClick={() => setShowAddMemberModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Add Member</Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

