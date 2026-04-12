import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { apiGet } from '../lib/api';

const COLORS = ['#5C92C9', '#E1222E', '#22c55e', '#6b7280', '#870B16', '#7FAED6'];

const STATUS_LABELS = { new: 'New', reviewed: 'Reviewed', resolved: 'Resolved' };

function formatMonth(str) {
  const [y, m] = str.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m) - 1]} ${y.slice(2)}`;
}

export default function AnalyticsCharts() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet('/dashboard/analytics')
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 h-72 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-6" />
            <div className="h-48 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const monthlyData = data.monthlySubmissions.map(d => ({ ...d, month: formatMonth(d.month) }));
  const statusData = data.statusBreakdown.map(d => ({ name: STATUS_LABELS[d.status] || d.status, value: d.count }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      {/* Monthly Submissions Trend */}
      {monthlyData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="font-semibold text-text mb-4">Monthly Submissions</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#E1222E" radius={[4, 4, 0, 0]} name="Submissions" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Status Breakdown */}
      {statusData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="font-semibold text-text mb-4">Submission Status</h3>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width="50%" height={220}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {statusData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-sm text-text">{d.name}: <strong>{d.value}</strong></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Form Performance */}
      {data.formPerformance.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="font-semibold text-text mb-4">Submissions by Form</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.formPerformance} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#5C92C9" radius={[0, 4, 4, 0]} name="Submissions" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top Products */}
      {data.topProducts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="font-semibold text-text mb-4">Most Requested Products</h3>
          <div className="space-y-3">
            {data.topProducts.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3">
                <span className="text-sm font-bold text-text-muted w-6">{i + 1}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-text">{p.name}</div>
                  <div className="mt-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${(p.mentions / data.topProducts[0].mentions) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-semibold text-primary">{p.mentions}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
