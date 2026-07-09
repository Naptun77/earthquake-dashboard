import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, Cell
} from 'recharts';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { axiosGetWithRetry } from './utils/retry';
import HeatmapLayer from './components/HeatmapLayer';

// 修复Leaflet默认图标问题
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function App() {
  const [earthquakes, setEarthquakes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const [minMagnitude, setMinMagnitude] = useState(0);
  const [timeRange, setTimeRange] = useState('day');
  const [trendData, setTrendData] = useState([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
  const [mapMode, setMapMode] = useState('marker');

  const fetchData = async () => {
    console.log('🔥 fetchData 被调用了, timeRange:', timeRange);
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/earthquakes?timeRange=${timeRange}`,
        {},
        {
          maxRetries: 3,
          delay: 1000,
          onRetry: (attempt) => console.log(`🔄 重试第 ${attempt} 次`)
        }
      );
      const features = response.data.data.features;
      console.log('收到响应，数据条数:', features.length);
      setEarthquakes(features);
      setLastUpdateTime(new Date());
      setError(null);
      checkStrongEarthquake(features);
    } catch (err) {
      console.error('请求失败:', err);
      setError('获取数据失败：' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrendData = async () => {
    console.log('📈 fetchTrendData 被调用了');
    if (earthquakes.length === 0) {
      setTrendData([]);
      setTrendLoading(false);
      return;
    }
    try {
      setTrendLoading(true);
      const today = new Date();
      const dailyCounts = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        const count = earthquakes.filter(q => {
          const qDate = new Date(q.properties.time);
          const qYear = qDate.getFullYear();
          const qMonth = String(qDate.getMonth() + 1).padStart(2, '0');
          const qDay = String(qDate.getDate()).padStart(2, '0');
          return `${qYear}-${qMonth}-${qDay}` === dateStr;
        }).length;
        dailyCounts.push({
          date: `${month}/${day}`,
          fullDate: dateStr,
          count: count,
          dayOfWeek: ['日', '一', '二', '三', '四', '五', '六'][date.getDay()]
        });
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      console.log('📈 最终趋势数据:', dailyCounts);
      setTrendData(dailyCounts);
    } catch (err) {
      console.error('获取趋势数据失败:', err);
    } finally {
      setTrendLoading(false);
    }
  };

  const checkStrongEarthquake = (features) => {
    const strongQuakes = features.filter(q => q.properties.mag >= 6);
    if (strongQuakes.length > 0 && 'Notification' in window && Notification.permission === 'granted') {
      const strongest = strongQuakes.reduce((a, b) => 
        a.properties.mag > b.properties.mag ? a : b
      );
      new Notification('🌍 强震警报！', {
        body: `${strongest.properties.place} 发生 ${strongest.properties.mag} 级地震！`,
        icon: '🔴',
        tag: 'strong-earthquake',
        requireInteraction: true
      });
    }
  };

  const handleRefresh = () => {
    fetchData();
  };

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  useEffect(() => {
    if (earthquakes.length > 0) {
      fetchTrendData();
    }
  }, [earthquakes]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const filteredEarthquakes = earthquakes.filter(q => q.properties.mag >= minMagnitude);

  const getMagnitudeDistribution = () => {
    const distribution = {};
    const step = 0.5;
    const start = 2.5;
    const end = 6.0;
    for (let i = start; i < end; i += step) {
      const key = `${i.toFixed(1)}-${(i + step).toFixed(1)}`;
      distribution[key] = 0;
    }
    distribution['6.0+'] = 0;
    filteredEarthquakes.forEach(quake => {
      const mag = quake.properties.mag;
      if (mag >= 6.0) {
        distribution['6.0+']++;
      } else if (mag >= start && mag < end) {
        for (let i = start; i < end; i += step) {
          if (mag >= i && mag < i + step) {
            const key = `${i.toFixed(1)}-${(i + step).toFixed(1)}`;
            distribution[key]++;
            break;
          }
        }
      }
    });
    return Object.entries(distribution).map(([range, count]) => ({ range, count }));
  };

  const getRecentTrend = () => {
    return [...filteredEarthquakes]
      .sort((a, b) => b.properties.time - a.properties.time)
      .slice(0, 10)
      .map(quake => ({
        name: quake.properties.place.substring(0, 15),
        magnitude: quake.properties.mag,
        time: new Date(quake.properties.time).toLocaleTimeString()
      }));
  };

  const exportToCSV = () => {
    if (filteredEarthquakes.length === 0) {
      alert('没有数据可以导出');
      return;
    }
    const headers = ['地点', '震级', '时间', '状态', '经度', '纬度', '深度(km)'];
    const rows = filteredEarthquakes.map(q => {
      const props = q.properties;
      const [lng, lat, depth] = q.geometry.coordinates;
      return [
        `"${props.place || '未知'}"`,
        props.mag || 0,
        new Date(props.time).toLocaleString(),
        props.status || '未知',
        lng || 0,
        lat || 0,
        depth || 0
      ];
    });
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `地震数据_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="text-4xl mb-4">🌍</div>
          <h2 className="text-xl text-gray-600 dark:text-gray-300">加载地震数据中...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <h2 className="text-xl text-red-600 dark:text-red-400">{error}</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* ===== 顶部导航 ===== */}
      <header className="bg-white/80 dark:bg-[#1a1d27]/80 backdrop-blur-sm border-b border-gray-200/60 dark:border-[#2a2d3a]/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between py-3 gap-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl sm:text-3xl">🌍</span>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                全球实时地震监测
              </h1>
              <span className="hidden sm:inline-block text-[10px] font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700">
                v1.0
              </span>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 px-3 py-1.5 rounded-full border border-gray-200/60 dark:border-gray-700/60">
                <span className="text-gray-400">📅</span>
                <span>{lastUpdateTime ? lastUpdateTime.toLocaleString() : '加载中...'}</span>
              </div>

              <button
                onClick={handleRefresh}
                className="group flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-full transition-all duration-200 text-xs sm:text-sm font-medium border border-indigo-200/50 dark:border-indigo-800/30"
              >
                <span className="group-hover:rotate-180 transition-transform duration-500">🔄</span>
                <span className="hidden sm:inline">刷新</span>
              </button>

              <button
                onClick={exportToCSV}
                className="group flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-full transition-all duration-200 text-xs sm:text-sm font-medium border border-emerald-200/50 dark:border-emerald-800/30"
              >
                <span>📥</span>
                <span className="hidden sm:inline">导出</span>
                <span className="hidden md:inline text-[10px] text-emerald-400 dark:text-emerald-500">CSV</span>
              </button>
            </div>
          </div>
        </div>
      </header>
      

      {/* ===== 主内容 ===== */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">

        {/* ===== 筛选控制栏 ===== */}
        <div className="flex flex-wrap items-center gap-3 mb-4 p-3 sm:p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <label className="font-medium text-gray-700 dark:text-gray-300 text-sm">🔍 震级:</label>
          <select
            value={minMagnitude}
            onChange={(e) => setMinMagnitude(Number(e.target.value))}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm"
          >
            <option value={0}>全部震级</option>
            <option value={3}>≥ 3.0 级</option>
            <option value={4.5}>≥ 4.5 级</option>
            <option value={6}>≥ 6.0 级</option>
          </select>

          <label className="font-medium text-gray-700 dark:text-gray-300 text-sm ml-0 sm:ml-2">📅 时间:</label>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm"
          >
            <option value="hour">过去1小时</option>
            <option value="day">过去24小时</option>
            <option value="week">过去7天</option>
            <option value="month">过去30天</option>
          </select>

          {minMagnitude > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              显示 ≥ {minMagnitude} 级
            </span>
          )}

          <span className="hidden lg:inline text-xs text-gray-400 dark:text-gray-500 ml-auto">
            📡 USGS · {
              timeRange === 'hour' ? '1h' : 
              timeRange === 'day' ? '24h' : 
              timeRange === 'week' ? '7d' : 
              '30d'
            } · ≥{timeRange === 'hour' ? '1.0' : timeRange === 'month' ? '4.5' : '2.5'}
          </span>  
        </div>

        {/* ===== KPI 统计卡片 ===== */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">📊 地震总数</h3>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white mt-1">{filteredEarthquakes.length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">⚡ 最高震级</h3>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-red-600 dark:text-red-400 mt-1">
              {filteredEarthquakes.length > 0 
                ? Math.max(...filteredEarthquakes.map(q => q.properties.mag)).toFixed(1)
                : '0'}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">📍 受影响地区</h3>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white mt-1">
              {new Set(filteredEarthquakes.map(q => q.properties.place?.split(',')[1] || '未知')).size}
            </p>
          </div>
        </div>

        {/* ===== 双图表 ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4 sm:mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white mb-3">震级分布图</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={getMagnitudeDistribution()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="range" tick={{ fontSize: 11 }} interval={0} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" name="地震次数" radius={[4, 4, 0, 0]}>
                  {getMagnitudeDistribution().map((entry, index) => {
                    const startValue = parseFloat(entry.range.split('-')[0]);
                    let color = '#4caf50';
                    if (startValue >= 2.5 && startValue < 3) color = '#4caf50';
                    else if (startValue >= 3 && startValue < 4.5) color = '#ffeb3b';
                    else if (startValue >= 4.5 && startValue < 6.0) color = '#ff9800';
                    else if (startValue >= 6.0) color = '#d32f2f';
                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white mb-3">最近10次地震震级趋势</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={getRecentTrend()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} interval={0} tick={{ fontSize: 8 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="magnitude" stroke="#8884d8" name="震级" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ===== 历史趋势 ===== */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 border border-gray-200 dark:border-gray-700 mb-4 sm:mb-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white mb-3">📈 过去7天每日地震数量趋势（≥2.5级）</h3>
          {timeRange === 'day' && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg mb-3 text-sm text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800">
              💡 当前显示 <strong>过去24小时</strong> 数据，切换至 "过去7天" 可查看完整趋势。
            </div>
          )}
          {trendLoading ? (
            <div className="h-64 flex justify-center items-center">
              <p className="text-gray-500 dark:text-gray-400">加载趋势数据中...</p>
            </div>
          ) : trendData.every(d => d.count === 0) ? (
            <div className="h-64 flex flex-col justify-center items-center text-gray-500 dark:text-gray-400">
              <div className="text-4xl mb-2">📭</div>
              <div>近7天无显著地震活动（≥2.5级）</div>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis label={{ value: '地震次数', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }} />
                  <Tooltip
                    formatter={(value) => [`${value} 次`, '地震数量']}
                    labelFormatter={(label, items) => {
                      const item = items[0]?.payload;
                      return item ? `${item.fullDate} (星期${item.dayOfWeek})` : label;
                    }}
                  />
                  <Legend />
                  <Bar dataKey="count" fill="#8884d8" name="地震数量" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-xs sm:text-sm">
                <div><strong>📊 7天总数:</strong> {trendData.reduce((sum, d) => sum + d.count, 0)} 次</div>
                <div><strong>📈 日均:</strong> {(trendData.reduce((sum, d) => sum + d.count, 0) / 7).toFixed(1)} 次</div>
                <div><strong>🔺 峰值:</strong> {Math.max(...trendData.map(d => d.count))} 次</div>
                <div><strong>🔻 最低:</strong> {Math.min(...trendData.map(d => d.count))} 次</div>
              </div>
            </>
          )}
        </div>

        {/* ===== 地图 ===== */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 border border-gray-200 dark:border-gray-700 mb-4 sm:mb-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white mb-3">🗺️ 地震位置分布图</h3>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">地图模式:</span>
            <button
              onClick={() => setMapMode('marker')}
              className={`px-3 py-1.5 rounded-l-lg border text-sm transition ${
                mapMode === 'marker'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              📍 标记点
            </button>
            <button
              onClick={() => setMapMode('heatmap')}
              className={`px-3 py-1.5 rounded-r-lg border text-sm transition ${
                mapMode === 'heatmap'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              🔥 热力图
            </button>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {mapMode === 'marker' ? '显示具体地震位置' : '显示地震密度分布'}
            </span>
          </div>
          <MapContainer center={[20, 0]} zoom={2} style={{ height: '400px', width: '100%', borderRadius: '8px' }}>
            <TileLayer
              url="https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}"
              attribution='&copy; <a href="https://www.amap.com/">高德地图</a>'
            />
            {mapMode === 'heatmap' && <HeatmapLayer data={filteredEarthquakes} />}
            {mapMode === 'marker' && filteredEarthquakes.map((quake, idx) => {
              const [lng, lat] = quake.geometry.coordinates;
              const mag = quake.properties.mag;
              return (
                <Marker key={idx} position={[lat, lng]}>
                  <Popup>
                    <strong>{quake.properties.place}</strong><br />
                    震级: <span style={{ fontWeight: 'bold' }}>{mag}</span><br />
                    时间: {new Date(quake.properties.time).toLocaleString()}<br />
                    <a href={quake.properties.url} target="_blank" rel="noopener noreferrer">查看详情</a>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
          <div className="flex flex-wrap justify-center gap-4 mt-3 text-xs sm:text-sm">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full bg-green-500"></span>
              <span>轻微 (2.5-4.5)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full bg-orange-500"></span>
              <span>中强 (4.5-6.0)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full bg-red-600"></span>
              <span>强震 (6.0+)</span>
            </div>
          </div>
        </div>

        {/* ===== 地震列表 ===== */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white mb-3">最近地震列表</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-3 py-2.5 text-left font-medium text-gray-600 dark:text-gray-300 text-xs sm:text-sm">地点</th>
                  <th className="px-3 py-2.5 text-left font-medium text-gray-600 dark:text-gray-300 text-xs sm:text-sm">震级</th>
                  <th className="px-3 py-2.5 text-left font-medium text-gray-600 dark:text-gray-300 text-xs sm:text-sm hidden sm:table-cell">时间</th>
                  <th className="px-3 py-2.5 text-left font-medium text-gray-600 dark:text-gray-300 text-xs sm:text-sm">状态</th>
                </tr>
              </thead>
              <tbody>
                {filteredEarthquakes.slice(0, 15).map((quake, idx) => {
                  const mag = quake.properties.mag;
                  const magColor = mag >= 6 ? 'text-red-600 dark:text-red-400' : mag >= 4.5 ? 'text-orange-500' : 'text-gray-700 dark:text-gray-300';
                  return (
                    <tr key={idx} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                      <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300 text-xs sm:text-sm">{quake.properties.place}</td>
                      <td className={`px-3 py-2.5 font-bold ${magColor} text-xs sm:text-sm`}>{mag}</td>
                      <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 text-xs sm:text-sm hidden sm:table-cell">{new Date(quake.properties.time).toLocaleString()}</td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          quake.properties.status === 'reviewed'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                        }`}>
                          {quake.properties.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;