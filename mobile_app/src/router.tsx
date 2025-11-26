import { useRoutes } from 'react-router-dom';
import routes from './router/config';

export const AppRoutes = () => {
  const element = useRoutes(routes);
  return element;
};
