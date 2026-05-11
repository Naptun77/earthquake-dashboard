import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line
} from 'recharts';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

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

  // 获取地震数据
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // 直接调用USGS API
        // const response = await axios.get(
        //   'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson'
        // );
        // setEarthquakes(response.data.features);
        const response = await axios.get('/api/earthquakes');
        // API返回格式为 { source, cached_at, data }，真实数据在data字段里
        setEarthquakes(response.data.data.features);
        setError(null);
      } catch (err) {
        setError('获取数据失败：' + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 准备图表数据：按震级分组统计
  const getMagnitudeDistribution = () => {
    const distribution = {
      '2.5-3.0': 0,
      '3.0-4.0': 0,
      '4.0-5.0': 0,
      '5.0-6.0': 0,
      '6.0+': 0,
    };
    
    earthquakes.forEach(quake => {
      const mag = quake.properties.mag;
      if (mag >= 2.5 && mag < 3.0) distribution['2.5-3.0']++;
      else if (mag >= 3.0 && mag < 4.0) distribution['3.0-4.0']++;
      else if (mag >= 4.0 && mag < 5.0) distribution['4.0-5.0']++;
      else if (mag >= 5.0 && mag < 6.0) distribution['5.0-6.0']++;
      else if (mag >= 6.0) distribution['6.0+']++;
    });
    
    return Object.entries(distribution).map(([range, count]) => ({ range, count }));
  };

  // 准备折线图数据：按时间排序的前10个地震
  const getRecentTrend = () => {
    return earthquakes
      .slice(0, 10)
      .map(quake => ({
        name: quake.properties.place.substring(0, 15),
        magnitude: quake.properties.mag,
        time: new Date(quake.properties.time).toLocaleTimeString()
      }))
      //.reverse();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <h2>加载地震数据中...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'red' }}>
        <h2>{error}</h2>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ textAlign: 'center', color: '#6600cc' }}>
        🌍 全球实时地震监测 Dashboard
      </h1>
      <p style={{ textAlign: 'center', color: '#666' }}>
        数据来源：USGS (过去24小时，震级 ≥ 2.5)
      </p>
      
      {/* 统计卡片 */}
      <div style={{ display: 'flex', justifyContent: 'space-around', margin: '20px 0' }}>
        <div style={{ background: '#f0f0f0', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
          <h3>📊 地震总数</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold' }}>{earthquakes.length}</p>
        </div>
        <div style={{ background: '#f0f0f0', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
          <h3>⚡ 最高震级</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#d32f2f' }}>
            {Math.max(...earthquakes.map(q => q.properties.mag), 0).toFixed(1)}
          </p>
        </div>
        <div style={{ background: '#f0f0f0', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
          <h3>📍 受影响地区</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold' }}>
            {new Set(earthquakes.map(q => q.properties.place.split(',')[1])).size}
          </p>
        </div>
      </div>

      {/* 双图表布局 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginBottom: '40px' }}>
        {/* 柱状图：震级分布 */}
        <div style={{ flex: 1, minWidth: '300px', background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h3>震级分布图</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={getMagnitudeDistribution()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#993333" name="地震次数" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 折线图：最近地震趋势 */}
        <div style={{ flex: 1, minWidth: '300px', background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h3>最近10次地震震级趋势</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={getRecentTrend()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} interval={0} tick={{fontSize: '8px'}} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="magnitude" stroke="#6666CC" name="震级" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 地图：显示地震位置 */}
      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
        <h3>地震位置分布图</h3>
        <MapContainer
          center={[20, 0]}
          zoom={2}
          style={{ height: '400px', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors'
          />
          {earthquakes.map((quake, idx) => {
            const [lng, lat] = quake.geometry.coordinates;
            const mag = quake.properties.mag;
            // 根据震级设置不同的颜色和大小
            const color = mag >= 6 ? '#d32f2f' : mag >= 5 ? '#ff9800' : '#4caf50';
            const radius = Math.max(8, mag * 3);
            return (
              <Marker
                key={idx}
                position={[lat, lng]}
              >
                <Popup>
                  <strong>{quake.properties.place}</strong><br />
                  震级: <span style={{ color, fontWeight: 'bold' }}>{mag}</span><br />
                  时间: {new Date(quake.properties.time).toLocaleString()}<br />
                  <a href={quake.properties.url} target="_blank" rel="noopener noreferrer">查看详情</a>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* 最近地震表格 */}
      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h3>最近地震列表</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ padding: '10px', border: '1px solid #ddd' }}>地点</th>
                <th style={{ padding: '10px', border: '1px solid #ddd' }}>震级</th>
                <th style={{ padding: '10px', border: '1px solid #ddd' }}>时间</th>
                <th style={{ padding: '10px', border: '1px solid #ddd' }}>状态</th>
              </tr>
            </thead>
            <tbody>
              {earthquakes.slice(0, 15).map((quake, idx) => {
                const mag = quake.properties.mag;
                const magColor = mag >= 6 ? '#d32f2f' : mag >= 5 ? '#ff9800' : '#333';
                return (
                  <tr key={idx}>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>{quake.properties.place}</td>
                    <td style={{ padding: '8px', border: '1px solid #ddd', color: magColor, fontWeight: 'bold' }}>{mag}</td>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>{new Date(quake.properties.time).toLocaleString()}</td>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>{quake.properties.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default App;

