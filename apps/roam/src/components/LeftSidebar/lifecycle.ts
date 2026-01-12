type LeftSidebarLifecycle = {
  mount: (() => Promise<void>) | null;
  unmount: (() => void) | null;
};

const lifecycle: LeftSidebarLifecycle = {
  mount: null,
  unmount: null,
};

export const registerLeftSidebarLifecycle = (fns: {
  mount: () => Promise<void>;
  unmount: () => void;
}): void => {
  lifecycle.mount = fns.mount;
  lifecycle.unmount = fns.unmount;
};

export const remountLeftSidebar = async (): Promise<void> => {
  if (lifecycle.mount) {
    await lifecycle.mount();
  }
};

export const unmountLeftSidebar = (): void => {
  if (lifecycle.unmount) {
    lifecycle.unmount();
  }
};
