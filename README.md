# 🌍 全球实时地震监测 Dashboard

## 📖 项目简介

> 一个基于 React + FastAPI 的实时地震数据可视化看板，从 USGS（美国地质调查局）获取全球地震数据，并通过图表、地图等多种方式可视化展示。用户可以通过时间范围切换、震级筛选等功能，深入分析地震活动趋势。

---

### 🌟 核心亮点

- ⚡ **实时数据**：直接从 USGS 官方 API 获取最新地震数据
- 🗺️ **交互地图**：支持标记点/热力图两种模式，直观展示地震分布
- 📊 **多维度图表**：震级分布柱状图、历史趋势折线图、实时数据表格
- 🔍 **灵活筛选**：按时间范围（1小时/24小时/7天/30天）和震级筛选数据
- 🔔 **强震通知**：检测到 6 级以上地震时浏览器推送通知
- 📥 **数据导出**：一键导出 CSV 格式数据，方便进一步分析

---

## 🛠️ 技术栈

### 前端

| 技术 | 用途 |
| :--- | :--- |
| [React 19](https://react.dev/) | UI 框架 |
| [Vite](https://vitejs.dev/) | 构建工具 |
| [Recharts](https://recharts.org/) | 图表库 |
| [Leaflet](https://leafletjs.com/) + [React-Leaflet](https://react-leaflet.js.org/) | 地图组件 |
| [Leaflet-Heat](https://github.com/Leaflet/Leaflet.heat) | 热力图插件 |
| [Axios](https://axios-http.com/) | HTTP 请求库 |

### 后端

| 技术 | 用途 |
| :--- | :--- |
| [FastAPI](https://fastapi.tiangolo.com/) | Web 框架 |
| [Uvicorn](https://www.uvicorn.org/) | ASGI 服务器 |
| [HTTPX](https://www.python-httpx.org/) | 异步 HTTP 客户端 |

### 部署

| 技术 | 用途 |
| :--- | :--- |
| Nginx | 静态文件托管 + 反向代理 |
| Systemd | 后端服务守护进程 |
| GoAccess | 访问日志分析 |

---

## 🚀 快速开始

### 克隆项目

```bash
git clone https://github.com/Naptun77/earthquake-dashboard.git
cd earthquake-dashboard
```

### 后端配置

```bash
cd backend
python -m venv venv
venv\Scripts\activate # Windows
pip install -r requirements.txt
python main.py
```

后端将在 `http://localhost:8000` 运行。

### 前端配置

```bash
cd frontend
npm install
npm run dev
```

前端将在 `http://localhost:5173` 运行。

---

## 📸 功能预览

### 主面板

- **统计卡片**：地震总数、最高震级、受影响地区
- **震级分布图**：按 0.5 级间隔统计地震分布
- **历史趋势图**：过去 7 天每日地震数量变化

### 地图

- **标记点模式**：显示具体地震位置，点击可查看详情
- **热力图模式**：展示地震密度分布

### 数据筛选

- **时间范围**：过去 1 小时 / 24 小时 / 7 天 / 30 天
- **震级筛选**：全部 / ≥4.0 / ≥5.0 / ≥6.0

### 其他功能

- 📥 **导出 CSV**：一键导出当前数据
- 🔔 **强震通知**：6 级以上地震自动推送
- 📊 **实时更新**：数据随筛选条件动态刷新

---

## 🔧 运维与监控

### 健康检查

```bash
curl http://localhost:8000/health
```

### Nginx 日志轮转

已配置 `logrotate`，每天轮转，保留 14 天日志。

### 访问统计

使用 GoAccess 生成可视化报告：

```bash
sudo goaccess /var/log/nginx/access.log -o /var/www/html/report.html --log-format=COMBINED
```

---

## 📝 数据源说明

本项目使用 USGS（美国地质调查局）提供的公开地震数据：

- **实时数据**：[USGS GeoJSON Feed](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php)
- **历史数据**：[USGS FDSN Event API](https://earthquake.usgs.gov/fdsnws/event/1/)

---

## 📄 License

MIT License

---

## 🙏 致谢

- [USGS](https://www.usgs.gov/) 提供免费的地震数据 API
- [OpenStreetMap](https://www.openstreetmap.org/) / [高德地图](https://www.amap.com/) 提供地图底图
- [Recharts](https://recharts.org/) 提供优美的图表组件

