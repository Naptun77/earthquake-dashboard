import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, Cell
} from 'recharts';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { axiosGetWithRetry } from './utils/retry'; //网络请求失败自动重试
import HeatmapLayer from './components/HeatmapLayer'; // 热力图

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
  const [lastUpdateTime, setLastUpdateTime] = useState(null); // 存储更新时间
  const [minMagnitude, setMinMagnitude] = useState(0); // 按震级筛选地震
  const [timeRange, setTimeRange] = useState('day');  // 默认24小时
  const [trendData, setTrendData] = useState([]);  // 历史趋势数据
  const [trendLoading, setTrendLoading] = useState(false);  // 趋势加载状态
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'; // 使用环境变量
  const [mapMode, setMapMode] = useState('marker'); // 'marker' 或 'heatmap'
  
  // 获取地震数据
  const fetchData = async () => {
    console.log('🔥 fetchData 被调用了, timeRange:', timeRange);
    try {
      setLoading(true);
      // const response = await axios.get('/api/earthquakes');
      // API返回格式为 { source, cached_at, data }，真实数据在data字段里
      // setEarthquakes(response.data.data.features);

      // 调用后端，传入timeRange参数
      // const response = await axios.get(`/api/earthquakes?timeRange=${timeRange}`);
      const response = await axios.get(`${API_BASE_URL}/earthquakes?timeRange=${timeRange}`,
        {},
        {
          maxRetries: 3,
          delay: 1000,
          onRetry: (attempt) => console.log(`🔄 重试第 ${attempt} 次`)
        }
      );
      // const url = timeRangeUrls[timeRange];
      // console.log('正在请求:', url);
      // const response = await axios.get(url);
      const features = response.data.data.features;
      console.log('收到响应，数据条数:', features.length);
      setEarthquakes(features);
      setLastUpdateTime(new Date()); // 记录更新时间
      setError(null);

      // ✅ 检查强震并发送通知
      checkStrongEarthquake(features);
    
    } catch (err) {
      console.error('请求失败:', err);
      setError('获取数据失败：' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 获取历史趋势数据（过去7天每天的地震数量）
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

      // 循环获取过去7天的数据
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);  

        // 格式化为 YYYY-MM-DD
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        // const response = await axios.get(`/api/trend?start_date=${dateStr}&end_date=${dateStr}&min_magnitude=2.5`);
        // const response = await axios.get(`${API_BASE_URL}/trend?start_date=${dateStr}&end_date=${dateStr}&min_magnitude=2.5`);        
        // const count = response.data.count || 0;

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

  // 检查强震并发送通知
  const checkStrongEarthquake = (features) => {
    // 检查是否有 6 级及以上地震
    const strongQuakes = features.filter(q => q.properties.mag >= 6);

    if (strongQuakes.length > 0 && 'Notification' in window && Notification.permission === 'granted') {
      // 只通知最高震级的地震
      const strongest = strongQuakes.reduce((a, b) => 
        a.properties.mag > b.properties.mag ? a : b
      );
      
      new Notification('🌍 强震警报！', {
        body: `${strongest.properties.place} 发生 ${strongest.properties.mag} 级地震！`,
        icon: '🔴',
        tag: 'strong-earthquake',
        requireInteraction: true  // 用户交互前不自动关闭
      });
    }
  };

  // 定义刷新函数
  const handleRefresh = () => {
      fetchData();
  }; // 添加一个刷新按钮

  // 首次加载 + timeRange 变化时重新获取
  useEffect(() => {
    fetchData();
    // fetchTrendData(); //获取趋势数据
  }, [timeRange]);

  // 当 earthquakes 更新后，再获取趋势
  useEffect(() => {
    if (earthquakes.length > 0) {
      fetchTrendData();
    }
  }, [earthquakes]);

  // 监听通知权限
  useEffect(() => {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}, []);

  const filteredEarthquakes = earthquakes.filter(q => q.properties.mag >= minMagnitude); // 计算筛选后的地震数据
  // 准备图表数据：按震级分组统计
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

  // 准备折线图数据：按时间排序的前10个地震
  const getRecentTrend = () => {
    // return filteredEarthquakes
    //   .slice(0, 10)
    //   .map(quake => ({
    //     name: quake.properties.place.substring(0, 15),
    //     magnitude: quake.properties.mag,
    //     time: new Date(quake.properties.time).toLocaleTimeString()
    //   }))
    //   .reverse();
    return [...filteredEarthquakes]
      .sort((a, b) => b.properties.time - a.properties.time)  // 按时间倒序（最新在前）
      .slice(0, 10)
      .map(quake => ({
        name: quake.properties.place.substring(0, 15),
        magnitude: quake.properties.mag,
        time: new Date(quake.properties.time).toLocaleTimeString()
      }));
  };

  // 导出 CSV 功能
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
    
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }); // \uFEFF 让 Excel 正确识别 UTF-8
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
        数据来源：USGS (
          {timeRange === 'hour' ? '过去1小时' : 
          timeRange === 'day' ? '过去24小时' : 
          timeRange === 'week' ? '过去7天' : '过去30天'}
          ，震级 ≥ {timeRange === 'hour' ? '1.0' : timeRange === 'month' ? '4.5' : '2.5'})
      </p>

      {/* 在页面上显示时间戳和刷新按钮 */}
      <div style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        margin: '10px 0 20px 0', padding: '10px 15px', background: '#f9f9f9',
        borderRadius: '8px', fontSize: '14px'
      }}>
        <span>
          📅 最后更新: {lastUpdateTime ? lastUpdateTime.toLocaleString() : '尚未加载'}
        </span>
        <button 
         onClick={handleRefresh}
          style={{
            padding: '6px 12px', background: '#1976d2', color: 'white',
            border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px'
          }}
          onMouseEnter={(e) => e.target.style.background = '#1565c0'}
          onMouseLeave={(e) => e.target.style.background = '#1976d2'}
        >
          🔄 刷新数据
        </button>
        <button
          onClick={exportToCSV}
          style={{
            padding: '6px 12px', background: '#28a745', color: 'white',
            border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px'
          }}
          onMouseEnter={(e) => e.target.style.background = '#218838'}
          onMouseLeave={(e) => e.target.style.background = '#28a745'}
        >
          📥 导出CSV
        </button>
      </div>

      {/* 筛选下拉菜单 */}
      <div style={{ margin: '15px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <label style={{ fontWeight: 'bold' }}>🔍 震级筛选:</label>
        <select 
          value={minMagnitude}
          onChange={(e) => setMinMagnitude(Number(e.target.value))}
          style={{
            padding: '6px 12px', borderRadius: '4px', border: '1px solid #ccc',
            background: 'white', cursor: 'pointer', color: '#333',
          }}
        >
          <option value={0}>全部震级</option>
          <option value={3}>≥ 3.0 级（有感地震）</option>
          <option value={4.5}>≥ 4.5 级（中强震）</option>
          <option value={6}>≥ 6.0 级（强震）</option>
        </select>
        {minMagnitude > 0 && (
          <span style={{ fontSize: '13px', color: '#666' }}>
          显示震级 ≥ {minMagnitude} 的地震
          </span>
        )}
      </div>

      {/* 时间范围选择器 */}
      <div style={{ 
        display: 'flex', alignItems: 'center', gap: '10px', margin: '10px 0',
        padding: '10px 15px', background: '#f0f4f8', borderRadius: '8px'
      }}>
        <label style={{ fontWeight: 'bold' }}>📅 时间范围:</label>
        <select 
          value={timeRange}
          onChange={(e) => {
            setTimeRange(e.target.value);
            // 切换后自动刷新数据
            // 注意：这里不能直接调用 fetchData，因为它在 useEffect 的依赖数组中
            // 我们会在 useEffect 中处理
          }}
          style={{padding: '6px 12px', borderRadius: '4px', border: '1px solid #ccc',
          background: 'white', cursor: 'pointer', fontSize: '14px', color: '#333'
          }}
        >
          <option value="hour">过去1小时 (≥1.0级)</option>
          <option value="day">过去24小时 (≥2.5级)</option>
          <option value="week">过去7天 (≥2.5级)</option>
          <option value="month">过去30天 (≥4.5级)</option>
        </select>
        <span style={{ fontSize: '13px', color: '#666' }}>
          {timeRange === 'hour' && '实时地震监测'}
          {timeRange === 'day' && '今日地震活动'}
          {timeRange === 'week' && '本周地震趋势'}
          {timeRange === 'month' && '月度地震统计'}
        </span>
      </div>

      {/* 统计卡片 */}
      <div style={{ display: 'flex', justifyContent: 'space-around', margin: '20px 0' }}>
        <div style={{ background: '#f0f0f0', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
          <h3>📊 地震总数</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold' }}>{filteredEarthquakes.length}</p>
        </div>
        <div style={{ background: '#f0f0f0', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
          <h3>⚡ 最高震级</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#d32f2f' }}>
            {/* {Math.max(...filteredEarthquakes.map(q => q.properties.mag), 0).toFixed(1)} */}
            {filteredEarthquakes.length > 0 
              ? Math.max(...filteredEarthquakes.map(q => q.properties.mag)).toFixed(1)
              : '0'}
          </p>
        </div>
        <div style={{ background: '#f0f0f0', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
          <h3>📍 受影响地区</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold' }}>
            {new Set(filteredEarthquakes.map(q => q.properties.place.split(',')[1])).size}
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
              <XAxis dataKey="range" tick={{fontSize: 15}} interval={0}/>
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" name="地震次数" radius={[4, 4, 0, 0]} >
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
      
      {/* 历史趋势分析图表 */}
      <div style={{
        background: 'white', padding: '20px', borderRadius: '8px', 
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginBottom: '20px' 
      }}>
        <h3>📈 过去7天每日地震数量趋势（≥2.5级）</h3>

        {timeRange === 'day' && (
          <div style={{background: '#fff3cd', padding: '10px 16px', borderRadius: '6px',
            marginBottom: '12px', fontSize: '14px', color: '#856404', border: '1px solid #ffc107'
          }}>
            💡 当前显示的是 <strong>过去24小时</strong> 的数据，趋势图仅显示今天的地震。
            切换至 <strong>"过去7天"</strong> 或 <strong>"过去30天"</strong> 可查看完整7天趋势。
          </div>
        )}

        {trendLoading ? (
          <div style={{ height: '250px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <p>加载趋势数据中...</p>
          </div>
        ) : (
          <>
            {/* ✅ 如果所有 count 都是 0，显示提示信息 */}
            {trendData.every(d => d.count === 0) ? (
              <div style={{ 
                height: '250px', display: 'flex', flexDirection: 'column', justifyContent: 'center', 
                alignItems: 'center', color: '#666', fontSize: '16px'
              }}>
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>📭</div>
                <div>近7天无显著地震活动（≥2.5级）</div>
                <div style={{ fontSize: '13px', marginTop: '8px', color: '#999' }}>
                  数据来源：USGS
                </div>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }}/>
                    <YAxis 
                      label={{ value: '地震次数', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
                    />
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
              
                {/* 趋势摘要信息 */}
                {trendData.length > 0 && (
                  <div style={{ 
                    display: 'flex', justifyContent: 'space-around', marginTop: '12px',
                    padding: '10px', background: '#f5f7fa', borderRadius: '6px', fontSize: '13px'
                  }}>
                    <div>
                      <strong>📊 7天总数:</strong> {trendData.reduce((sum, d) => sum + d.count, 0)} 次
                    </div>
                    <div>
                      <strong>📈 日均:</strong> {(trendData.reduce((sum, d) => sum + d.count, 0) / 7).toFixed(1)} 次
                    </div>
                    <div>
                      <strong>🔺 峰值:</strong> {Math.max(...trendData.map(d => d.count))} 次
                    </div>
                    <div>
                      <strong>🔻 最低:</strong> {Math.min(...trendData.map(d => d.count))} 次
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* 地图：显示地震位置 */}
      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
        <h3>地震位置分布图</h3>
        {/* 地图模式切换 */}
        <div style={{display: 'flex', alignItems: 'center', gap: '10px',
        marginBottom: '12px', padding: '8px 12px', background: '#f5f5f5', borderRadius: '6px'
        }}>
          <span style={{ fontWeight: 'bold', fontSize: '14px' }}>🗺️ 地图模式:</span>
          <button 
            onClick={() => setMapMode('marker')}
            style={{
              padding: '4px 16px',
              background: mapMode === 'marker' ? '#1976d2' : 'white',
              color: mapMode === 'marker' ? 'white' : '#333',
              border: '1px solid #ccc',
              borderRadius: '4px 0 0 4px',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            📍 标记点
          </button>
          <button 
            onClick={() => setMapMode('heatmap')}
            style={{
              padding: '4px 16px',
              background: mapMode === 'heatmap' ? '#1976d2' : 'white',
              color: mapMode === 'heatmap' ? 'white' : '#333',
              border: '1px solid #ccc',
              borderRadius: '0 4px 4px 0',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            🔥 热力图
          </button>
          <span style={{ fontSize: '12px', color: '#888' }}>
            {mapMode === 'marker' ? '显示具体地震位置' : '显示地震密度分布'}
          </span>
        </div>

        <MapContainer center={[20, 0]} zoom={2} style={{ height: '400px', width: '100%' }}>
          <TileLayer
            // url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            // url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            // attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors'
            url="https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}"
            attribution='&copy; <a href="https://www.amap.com/">高德地图</a>'
          />

          {/* 热力图模式 */}
          {/* <HeatmapLayer data={earthquakes.filter(quake => quake.properties.mag >= minMagnitude)} /> */}
          {mapMode === 'heatmap' && (<HeatmapLayer data={filteredEarthquakes} />)}
          
          {/* 标记点模式 */}
          {/* {earthquakes
            .filter(quake => quake.properties.mag >= minMagnitude) // 过滤震级小于指定值的地震
            .map((quake, idx) => { */}
          {mapMode === 'marker' && (
            filteredEarthquakes.map((quake, idx) => {
              const [lng, lat] = quake.geometry.coordinates;
              const mag = quake.properties.mag;
              // 根据震级设置不同的颜色和大小
              const color = mag >= 6 ? '#d32f2f' : mag >= 5 ? '#ff9800' : '#4caf50';
              const radius = Math.max(8, mag * 3);
              return (
                <Marker key={idx} position={[lat, lng]}>
                  <Popup>
                    <strong>{quake.properties.place}</strong><br />
                    震级: <span style={{ color, fontWeight: 'bold' }}>{mag}</span><br />
                    时间: {new Date(quake.properties.time).toLocaleString()}<br />
                    <a href={quake.properties.url} target="_blank" rel="noopener noreferrer">查看详情</a>
                  </Popup>
                </Marker>
              );
            })
          )}
        </MapContainer>

        {/* 地图图例 */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '12px',
          padding: '8px', background: '#f5f5f5', borderRadius: '6px', fontSize: '13px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: '16px', height: '16px', borderRadius: '50%', background: '#4caf50' }}></span>
            <span>轻微 (2.5 - 4.5)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: '16px', height: '16px', borderRadius: '50%', background: '#ff9800' }}></span>
            <span>中强 (4.5 - 6.0)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: '16px', height: '16px', borderRadius: '50%', background: '#d32f2f' }}></span>
            <span>强震 (6.0+)</span>
          </div>
        </div>
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
              {earthquakes
                .filter(quake => quake.properties.mag >= minMagnitude) // 过滤震级小于指定值的地震
                .slice(0, 15).map((quake, idx) => {
                const mag = quake.properties.mag;
                const magColor = mag >= 6 ? '#d32f2f' : mag >= 4.5 ? '#ff9800' : '#333';
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

