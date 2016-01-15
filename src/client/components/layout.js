import Meta from './meta';
import React, {Component} from 'react';

export default class extends Component {
  render() {
    return (
      <Meta title='Turbo Car Club'>
        {this.props.children}
      </Meta>
    );
  }
}