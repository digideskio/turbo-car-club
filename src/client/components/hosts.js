import _ from 'underscore';
import live from '../utils/live';
import Host from './host';
import React from 'react';
import FalcomlayComponent from './falcomlay-component';
import ReactList from 'react-list';

import store from '../utils/store';

export default class extends FalcomlayComponent {
  store = store;

  getQuery() {
    const {from, size} = this.state;
    return [
      'hosts',
      [
        'length',
        [_.range(from, from + size), Host.fragments().host]
      ]
    ];
  }

  getPaths() {
    return {
      hosts: ['hosts']
    };
  }

  state = {
    from: 0,
    size: 10
  };

  componentWillMount() {
    super.componentWillMount();
    live
      .send('sub', 'host-added').on('host-added', this.update)
      .send('sub', 'host-removed').on('host-removed', this.update);
  }

  componentWillUnmount() {
    super.componentWillMount();
    live.off(this.update);
  }

  update = () => {
    const {hosts, from, size} = this.state;
    if (!hosts) return;
    for (let index of hosts) {
      index = parseInt(index);
      if (isNaN(index)) continue;
      if (index < from || index > from + size) {
        store.set(['hosts', index], undefined);
      }
    }
    this.runQuery({force: true});
  }

  updateRange = _.debounce(() => {
    const {from, size} = this.list.state;
    this.setState({from, size});
  }, 100);

  renderHost = (index, key) => {
    let host = this.state.hosts[index];
    if (!host) {
      this.updateRange();
      host = {name: 'Loading...', owner: {id: 'Loading...'}};
    }
    return <Host {...{key, host}} />;
  }

  render() {
    const {error, hosts} = this.state;
    return (
      <div>
        <div>Hosts</div>
        {error ? error.toString() : null}
        <ReactList
          itemRenderer={this.renderHost}
          length={hosts && hosts.length || 0}
          ref={c => this.list = c}
          type='uniform'
          updateForHosts={hosts}
        />
      </div>
    );
  }
}
