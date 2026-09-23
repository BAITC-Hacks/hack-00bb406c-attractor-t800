import React from 'react';
const files = import.meta.glob('./icons/*.js', { eager: true, import: 'default' });
export function Icon({name, size=22, className='', ...props}) {
  const nodes = files[`./icons/${name}.js`] || files['./icons/sprout.js'];
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" {...props}>{nodes.map(([tag, attributes], i)=>React.createElement(tag,{...attributes,key:i}))}</svg>;
}
