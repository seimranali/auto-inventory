import { api } from '../api';
import { useAsync } from '../hooks';
import { PageHeader, Panel, Loader, ErrorBox } from '../components';
import { RoleBadge } from './UsersPage';

export default function RolesPage() {
  const { data, error, loading } = useAsync(() => api.users());
  if (loading) return <Loader />;
  if (error) return <ErrorBox error={error} />;

  const roles = Object.entries(data.roles);
  const perms = Object.entries(data.permissions);
  const countFor = r => data.users.filter(u => u.role === r && u.active).length;

  return (
    <>
      <PageHeader title="User Roles" subtitle="What each role can do. Assign roles on the Users page." />

      <div className="role-cards">
        {roles.map(([name, r]) => (
          <div key={name} className="card role-card">
            <div className="row spread"><RoleBadge role={name} /><span className="muted">{countFor(name)} active user{countFor(name) === 1 ? '' : 's'}</span></div>
            <p>{r.description}</p>
            <small className="muted">{r.permissions.length} of {perms.length} permissions</small>
          </div>
        ))}
      </div>

      <Panel title="Permission Matrix">
        <div className="table-wrap">
          <table className="perm-table">
            <thead>
              <tr><th>Permission</th>{roles.map(([name]) => <th key={name} className="center">{name}</th>)}</tr>
            </thead>
            <tbody>
              {perms.map(([key, label]) => (
                <tr key={key}>
                  <td><b>{label}</b><small>{key}</small></td>
                  {roles.map(([name, r]) => (
                    <td key={name} className="center">
                      {r.permissions.includes(key)
                        ? <span className="perm-yes" aria-label="Allowed">✓</span>
                        : <span className="perm-no" aria-label="Not allowed">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
