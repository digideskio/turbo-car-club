import './utils/set-global';
import './utils/live-reload';
import './utils/live';
import React from 'react';
import {render} from 'react-dom';
import {Router} from 'react-router';
import routes from './routes';

render(<Router {...{routes}} />, document.getElementById('main'));
