
export const createRouter = (store) => {
  const routes = {
    '#/nickname': 'nickname',
    '#/lobby': 'lobby',
    '#/game': 'game',
    '#/gameover': 'gameover',
  };

  const getScreenFromHash = () => {
    const hash = window.location.hash || '#/nickname';
    return routes[hash] || 'nickname';
  };

  const handleHashChange = () => {
    const screen = getScreenFromHash();
    store.dispatch({
      type: 'SET_SCREEN',
      payload: screen,
    });
  };

  window.onhashchange = handleHashChange;


  // Initial route handling
  handleHashChange();

  // Function to navigate
  const navigate = (path) => {
    window.location.hash = path;
  };

  return { navigate };
};
