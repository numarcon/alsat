"use client";

import { Component, type ReactNode } from "react";

export default class MapErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(previous: Readonly<{ resetKey: string }>) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  render() {
    if (this.state.failed) {
      return <section className="map-safe-fallback"><span>⌖</span><strong>Карта уақытша жаңартылмады</strong><small>Тапсырыстар сақталды. Картаны қайта жүктеп көріңіз.</small><button onClick={() => this.setState({ failed: false })}>Картаны қайта ашу</button></section>;
    }
    return this.props.children;
  }
}
