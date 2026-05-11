from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
from datetime import datetime
from typing import Dict, Any, List

app = FastAPI(title="地震监测API", description="USGS地震数据的后端代理服务", version="1.0.0")

# 配置CORS，允许前端跨域请求
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 开发阶段允许所有来源，生产环境需要限制
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# USGS API地址
USGS_API_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson"

# 简单的缓存（避免频繁请求USGS）
cache: Dict[str, Any] = {
    "data": None,
    "timestamp": None
}
CACHE_TTL_SECONDS = 300  # 缓存5分钟


@app.get("/")
async def root():
    return {
        "message": "地震监测API服务",
        "docs": "/docs",
        "endpoints": ["/api/earthquakes", "/api/earthquakes/summary", "/api/health"]
    }


@app.get("/api/health")
async def health_check():
    """健康检查接口"""
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


@app.get("/api/earthquakes")
async def get_earthquakes(force_refresh: bool = False):
    """
    获取地震数据
    - force_refresh: 是否强制刷新缓存
    """
    global cache
    
    # 检查缓存是否有效
    if not force_refresh and cache["data"] and cache["timestamp"]:
        elapsed = (datetime.now() - cache["timestamp"]).total_seconds()
        if elapsed < CACHE_TTL_SECONDS:
            return {
                "source": "cache",
                "cached_at": cache["timestamp"].isoformat(),
                "data": cache["data"]
            }
    
    try:
        # 异步请求USGS API
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(USGS_API_URL)
            response.raise_for_status()
            raw_data = response.json()
        
        # 更新缓存
        cache["data"] = raw_data
        cache["timestamp"] = datetime.now()
        
        return {
            "source": "usgs_live",
            "cached_at": cache["timestamp"].isoformat(),
            "data": raw_data
        }
        
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="USGS API请求超时")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"USGS API错误: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"服务器内部错误: {str(e)}")


@app.get("/api/earthquakes/summary")
async def get_earthquakes_summary():
    """获取地震数据摘要（不返回完整数据，减少传输量）"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(USGS_API_URL)
            response.raise_for_status()
            raw_data = response.json()
        
        features = raw_data.get("features", [])
        
        # 提取摘要信息
        summary = {
            "total_count": len(features),
            "max_magnitude": 0,
            "min_magnitude": float('inf'),
            "avg_magnitude": 0,
            "latest_earthquake": None,
            "top_5": []
        }
        
        magnitudes = []
        for feature in features:
            props = feature.get("properties", {})
            mag = props.get("mag", 0)
            if mag:
                magnitudes.append(mag)
                if mag > summary["max_magnitude"]:
                    summary["max_magnitude"] = mag
                if mag < summary["min_magnitude"]:
                    summary["min_magnitude"] = mag
        
        if magnitudes:
            summary["avg_magnitude"] = round(sum(magnitudes) / len(magnitudes), 2)
        
        # 震级最高的5条地震
        top_5 = sorted(features, key=lambda x: x.get("properties", {}).get("mag", 0), reverse=True)[:5]
        summary["top_5"] = [
            {
                "place": f.get("properties", {}).get("place", "未知"),
                "magnitude": f.get("properties", {}).get("mag", 0),
                "time": f.get("properties", {}).get("time")
            }
            for f in top_5
        ]
        
        # 最新的地震（按时间）
        if features:
            latest = max(features, key=lambda x: x.get("properties", {}).get("time", 0))
            summary["latest_earthquake"] = {
                "place": latest.get("properties", {}).get("place", "未知"),
                "magnitude": latest.get("properties", {}).get("mag", 0),
                "time": latest.get("properties", {}).get("time")
            }
        
        return summary
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取摘要失败: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)