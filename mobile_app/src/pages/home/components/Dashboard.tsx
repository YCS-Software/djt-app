
import { useState, useEffect } from 'react';
import { dashboardService } from '../../../services/api';
import Card from '../../../components/base/Card';
import Button from '../../../components/base/Button';

export default function Dashboard() {
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [stationUsage, setStationUsage] = useState<any[]>([]);
  const [weeklyActivity, setWeeklyActivity] = useState<any[]>([]);

  // Fetch dashboard data from API
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Fetch all dashboard data in parallel
        const [stats, monthly, weekly, stations] = await Promise.all([
          dashboardService.getStats(),
          dashboardService.getMonthlyAnalytics(6),
          dashboardService.getWeeklyActivity(),
          dashboardService.getFavoriteStations()
        ]);

        setDashboardStats(stats);
        setMonthlyData(monthly);
        setWeeklyActivity(weekly);
        setStationUsage(stations);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        // Set default values on error
        setDashboardStats({
          total_sessions: 0,
          total_energy_kwh: 0,
          total_spent: 0,
          co2_saved_kg: 0
        });
        setMonthlyData([]);
        setWeeklyActivity([]);
        setStationUsage([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Format stats for display
  const stats = dashboardStats ? [
    {
      title: 'Total Charging',
      value: dashboardStats.total_energy_kwh?.toLocaleString() || '0',
      unit: 'kWh',
      change: '+12%',
      icon: 'ri-flashlight-line',
      color: '#76B82A',
      bgColor: 'rgba(118, 184, 42, 0.1)'
    },
    {
      title: 'Total Spent',
      value: `₹${dashboardStats.total_spent?.toLocaleString() || '0'}`,
      unit: '',
      change: '+8%',
      icon: 'ri-money-rupee-circle-line',
      color: '#52A01E',
      bgColor: 'rgba(82, 160, 30, 0.1)'
    },
    {
      title: 'Sessions',
      value: dashboardStats.total_sessions?.toString() || '0',
      unit: 'completed',
      change: '+15%',
      icon: 'ri-calendar-check-line',
      color: '#9FD24A',
      bgColor: 'rgba(159, 210, 74, 0.1)'
    },
    {
      title: 'CO₂ Saved',
      value: Math.round(dashboardStats.co2_saved_kg || 0).toString(),
      unit: 'kg',
      change: '+20%',
      icon: 'ri-leaf-line',
      color: '#76B82A',
      bgColor: 'rgba(118, 184, 42, 0.1)'
    }
  ] : [];

  // Show loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="ev-stat-card-home animate-pulse">
              <div className="h-20 bg-gray-200 rounded"></div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          {stats.map((stat, index) => (
            <Card key={index} className="ev-stat-card-home">
              <div className="flex items-center justify-between mb-3">
                <div className="ev-stat-icon-home" style={{background: stat.bgColor}}>
                  <i className={stat.icon} style={{color: stat.color, fontSize: '1.25rem'}}></i>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{color: '#52A01E', background: 'rgba(118, 184, 42, 0.1)'}}>
                  {stat.change}
                </span>
              </div>
              <h3 className="ev-stat-value-home">
                {stat.value}
                {stat.unit && <span className="text-sm font-normal text-gray-500 ml-1">{stat.unit}</span>}
              </h3>
              <p className="ev-stat-label-home">{stat.title}</p>
            </Card>
          ))}
        </div>

        {/* Monthly Summary */}
        <div className="ev-charging-session relative overflow-hidden" style={{background: 'linear-gradient(135deg, #76B82A 0%, #52A01E 100%)', borderRadius: '16px', padding: '1.5rem', color: 'white', boxShadow: '0 15px 40px rgba(118, 184, 42, 0.3)'}}>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div>
              <h3 className="text-lg font-bold mb-1">December 2024</h3>
              <p className="text-white/90 text-sm">Monthly Summary</p>
            </div>
            <button 
              onClick={() => setShowDetailsModal(true)}
              className="text-sm font-bold bg-white/20 px-4 py-2 rounded-full hover:bg-white/30 transition-colors backdrop-blur-sm"
              style={{color: 'white'}}
            >
              View Details
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4 relative z-10">
            <div className="text-center">
              <p className="text-2xl font-bold">38</p>
              <p className="text-white/90 text-xs font-medium">Avg Session (min)</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">₹285</p>
              <p className="text-white/90 text-xs font-medium">Avg Cost</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">12</p>
              <p className="text-white/90 text-xs font-medium">Stations Used</p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="ev-stat-card-home text-center p-3">
            <p className="text-lg font-bold" style={{color: '#76B82A'}}>38</p>
            <p className="text-gray-600 text-xs font-semibold">Avg Time (min)</p>
          </Card>
          <Card className="ev-stat-card-home text-center p-3">
            <p className="text-lg font-bold" style={{color: '#52A01E'}}>12</p>
            <p className="text-gray-600 text-xs font-semibold">Stations</p>
          </Card>
          <Card className="ev-stat-card-home text-center p-3">
            <p className="text-lg font-bold" style={{color: '#9FD24A'}}>4.8</p>
            <p className="text-gray-600 text-xs font-semibold">Rating</p>
          </Card>
        </div>
      </div>

      {/* Detailed Analytics Modal */}
      {showDetailsModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Charging Analytics</h3>
                <p className="text-sm text-gray-500 mt-1">Detailed insights & trends</p>
              </div>
              <button 
                onClick={() => setShowDetailsModal(false)}
                className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <i className="ri-close-line text-xl text-gray-700"></i>
              </button>
            </div>

            {/* Monthly Trend Chart */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900">6-Month Trend</h4>
              <div className="space-y-3">
                {monthlyData.map((data, index) => (
                  <div key={data.month} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-medium text-gray-600 w-8">{data.month}</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2 w-24">
                        <div 
                          className="h-2 rounded-full transition-all duration-500"
                          style={{ width: `${(data.sessions / 30) * 100}%`, background: 'linear-gradient(90deg, #76B82A, #52A01E)' }}
                        ></div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{data.sessions}</p>
                      <p className="text-xs text-gray-500">{data.energy} kWh</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Station Usage */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900">Favorite Stations</h4>
              <div className="space-y-3">
                {stationUsage.map((station, index) => (
                  <div key={station.name} className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{station.name}</p>
                      <div className="flex items-center mt-1">
                        <div className="flex-1 bg-gray-200 rounded-full h-1.5 mr-3">
                          <div 
                            className={`h-1.5 rounded-full transition-all duration-500 ${
                              index === 0 ? 'bg-blue-600' :
                              index === 1 ? 'bg-green-600' :
                              index === 2 ? 'bg-purple-600' :
                              index === 3 ? 'bg-orange-600' : 'bg-gray-400'
                            }`}
                            style={{ width: `${station.percentage}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-500">{station.percentage}%</span>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 ml-3">{station.sessions}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Weekly Activity */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900">Weekly Activity</h4>
              <div className="flex items-end justify-between space-x-2">
                {weeklyActivity.map((day, index) => (
                  <div key={day.day} className="flex-1 text-center">
                    <div 
                      className="rounded-t-lg mb-2 transition-all duration-500"
                      style={{ 
                        height: `${(day.sessions / 4) * 40 + 10}px`,
                        background: 'linear-gradient(180deg, #76B82A, #52A01E)'
                      }}
                    ></div>
                    <p className="text-xs text-gray-600">{day.day}</p>
                    <p className="text-xs font-semibold text-gray-900">{day.sessions}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Environmental Impact */}
            <div className="bg-green-50 rounded-xl p-4 space-y-3">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                  <i className="ri-leaf-line text-green-600"></i>
                </div>
                <h4 className="font-semibold text-green-900">Environmental Impact</h4>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-2xl font-bold text-green-900">285 kg</p>
                  <p className="text-xs text-green-700">CO₂ Saved</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-900">142</p>
                  <p className="text-xs text-green-700">Trees Equivalent</p>
                </div>
              </div>
              <p className="text-xs text-green-700">
                Your EV charging has saved the equivalent of planting 142 trees! 🌱
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setShowDetailsModal(false)}
              >
                <i className="ri-download-line mr-2"></i>
                Export Data
              </Button>
              <Button 
                className="flex-1"
                onClick={() => setShowDetailsModal(false)}
              >
                <i className="ri-share-line mr-2"></i>
                Share Report
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
