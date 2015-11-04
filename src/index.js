import React from 'react';
import { render } from 'react-dom';
import SmartTextArea from './SmartTextArea';
import Dropdown from 'react-dropdown';

var options = [
	{ value: 'Radha', label: 'Radha' },
	{ value: 'Kishan', label: 'Kishan' }
];

function getListComponent(onChange) {
	return Dropdown;
}

render(<SmartTextArea getListComponent={getListComponent} />, document.getElementById('root'));
