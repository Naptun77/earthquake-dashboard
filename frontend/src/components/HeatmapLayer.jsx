import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { heatLayer } from '@linkurious/leaflet-heat';

const HeatmapLayer = ({ data }) => {
  const map = useMap();
  
  useEffect(() => {
    if (!data || data.length === 0) return;
    
    // 转换数据格式：[[lat, lng, intensity], ...]
    const points = data.map(q => {
      const [lng, lat] = q.geometry.coordinates;
      // 用震级作为强度，最低 0.5，最高 2.0
      const intensity = Math.min(2.0, Math.max(0.5, q.properties.mag / 3));
      return [lat, lng, intensity];
    });
    
    // 创建热力图图层
    const heat = heatLayer(points, {
      radius: 25,        // 热力半径
      blur: 15,          // 模糊程度
      maxZoom: 10,
      minOpacity: 0.3,
      gradient: {
        0.2: 'blue',
        0.4: 'cyan',
        0.6: 'lime',
        0.8: 'yellow',
        1.0: 'red'
      }
    });
    
    heat.addTo(map);
    
    // 清理函数：组件卸载时移除图层
    return () => {
      map.removeLayer(heat);
    };
  }, [map, data]);
  
  return null;
};

export default HeatmapLayer;