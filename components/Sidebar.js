'use client';

export default function Sidebar({ items, active, onSelect }) {
  return (
    <div className="sidebar-nav">
      {items.map(item => (
        <div
          key={item.id}
          className={`sidebar-item ${active === item.id ? 'active' : ''}`}
          onClick={() => onSelect(item.id)}
        >
          <span>{item.icon ? `${item.icon} ` : ''}{item.label}</span>
          {item.badge !== undefined && item.badge !== '' && <span className="badge">{item.badge}</span>}
        </div>
      ))}
    </div>
  );
}
