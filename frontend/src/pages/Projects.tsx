import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import Card from '../components/Card';
import Button from '../components/Button';
import { Input } from '../components/Input';
import { api } from '../api/api';
import './Projects.css';

export default function Projects() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    start_date: '',
    end_date: '',
  });

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const response = await api.getProjects();
      setProjects(response.data);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createProject(newProject);
      setShowCreateModal(false);
      setNewProject({ name: '', start_date: '', end_date: '' });
      loadProjects();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create project');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="loading">Loading projects...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="projects-page">
        <div className="page-header">
          <h1>Projects</h1>
          <Button onClick={() => setShowCreateModal(true)}>Create Project</Button>
        </div>

        {showCreateModal && (
          <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>Create New Project</h2>
              <form onSubmit={handleCreate}>
                <Input
                  label="Project Name"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  required
                  autoFocus
                />
                <Input
                  type="date"
                  label="Start Date (Optional)"
                  value={newProject.start_date}
                  onChange={(e) => setNewProject({ ...newProject, start_date: e.target.value })}
                />
                <Input
                  type="date"
                  label="End Date (Optional)"
                  value={newProject.end_date}
                  onChange={(e) => setNewProject({ ...newProject, end_date: e.target.value })}
                />
                <div className="modal-actions">
                  <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create</Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {projects.length === 0 ? (
          <Card>
            <p>No projects yet. Create your first project to get started!</p>
          </Card>
        ) : (
          <div className="projects-grid">
            {projects.map((project) => (
              <Link key={project.id} to={`/projects/${project.id}`} className="project-card">
                <Card>
                  <h3>{project.name}</h3>
                  <div className="project-meta">
                    {project.start_date && (
                      <div>Start: {new Date(project.start_date).toLocaleDateString()}</div>
                    )}
                    {project.end_date && (
                      <div>End: {new Date(project.end_date).toLocaleDateString()}
                      </div>
                    )}
                    <div className="project-role">Role: {project.role}</div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

