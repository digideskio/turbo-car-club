import db from 'client/utils/db';
import React, {Component} from 'react';
import live from 'client/utils/live';

export default class extends Component {
  componentDidMount() {
    const {location: {query: {key}}, history: {replaceState}} = this.props;
    if (!key) return replaceState(null, '/');
    live.send('verify', key, (er, auth) => {
      if (er) return console.error(er);
      db.set('auth', auth);
      console.log('verify authorized!');
      replaceState(null, '/');
    });
  }

  render() {
    return (
      <div>
        Do verify stuff
      </div>
    );
  }
}
