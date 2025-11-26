import { useState, useEffect } from 'react';
import { sessionService } from '../../../services/api';
import Card from '../../../components/base/Card';

export default function ChargingSessions() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch recent charging sessions
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoading(true);
        const data = await sessionService.getSessionHistory(3, 0, 'completed');
        setSessions(data);
      } catch (error) {
        console.error('Error fetching sessions:', error);
        setSessions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, []);

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return `Today, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }
  };

  if (loading) {
    return (
      <Card>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">Recent Sessions</h3>
        <button className="text-sm font-bold" style={{color: '#76B82A'}}>View All</button>
      </div>
      <div className="space-y-3">
        {sessions.length > 0 ? (
          sessions.map((session) => (
            <div key={session.session_id} className="ev-session-card">
              <div className="flex items-center">
                <div className="ev-session-icon ev-session-completed">
                  <i className="ri-flashlight-fill"></i>
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{session.station_name}</p>
                  <p className="text-gray-500 text-xs">{formatDate(session.start_time)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900 text-sm">₹{session.cost?.toFixed(0)}</p>
                <p className="text-gray-500 text-xs">{session.energy_consumed?.toFixed(1)} kWh</p>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">
            <i className="ri-flashlight-line text-4xl mb-2"></i>
            <p>No charging sessions yet</p>
          </div>
        )}
      </div>
    </Card>
  );
}
