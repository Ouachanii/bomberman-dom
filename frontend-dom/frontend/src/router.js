import { createRouter as createFrameworkRouter } from '../framework/router.js';
import { store } from './store.js';

export const router = createFrameworkRouter(store);
