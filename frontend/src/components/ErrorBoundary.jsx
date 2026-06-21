import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('❌ 错误边界捕获到错误:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          padding: '20px',
          textAlign: 'center',
          fontFamily: 'Arial, sans-serif'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>😵</div>
          <h2 style={{ color: '#d32f2f' }}>页面出错了</h2>
          <p style={{ color: '#666', marginBottom: '8px' }}>
            抱歉，页面渲染时发生了错误。
          </p>
          <details style={{ margin: '16px 0', fontSize: '13px', color: '#999', maxWidth: '600px' }}>
            <summary>查看错误详情</summary>
            <pre style={{ 
              background: '#f5f5f5', 
              padding: '12px', 
              borderRadius: '4px',
              textAlign: 'left',
              overflow: 'auto',
              fontSize: '12px'
            }}>
              {this.state.error?.message || '未知错误'}
            </pre>
          </details>
          <button
            onClick={this.handleReset}
            style={{
              padding: '10px 24px',
              background: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              marginTop: '12px'
            }}
          >
            🔄 刷新页面
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}