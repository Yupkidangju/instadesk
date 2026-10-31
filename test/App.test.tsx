// test/App.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../src/App';
import { cryptoVault } from '../src/services/cryptoVault';

// JSDOM matchMedia Mock
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// JSDOM ResizeObserver Mock
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('InstaBox Deck App Full Integration', () => {
  beforeEach(() => {
    cryptoVault.resetVault();
  });

  it('should render header bar and neo-swiss system elements', () => {
    render(<App />);

    // 로고 확인
    expect(screen.getByText('INSTABOX')).toBeDefined();
    expect(screen.getByText('//DECK')).toBeDefined();

    // 사이드바 인덱스 확인
    expect(screen.getByText('NODE_INVENTORY')).toBeDefined();

    // 푸터 확인
    expect(screen.getByText('SYSTEMS OPERATIONAL')).toBeDefined();
    expect(screen.getByText('ELECTRON DESKTOP // DIRECT INSTABOX API')).toBeDefined();
  });

  it('should open Key Vault modal upon clicking KEY VAULT button', () => {
    render(<App />);

    const keyVaultBtn = screen.getByText('KEY VAULT');
    fireEvent.click(keyVaultBtn);

    expect(screen.getByText(/ENCRYPTED KEY VAULT \/\/ SECURITY MANAGEMENT/i)).toBeDefined();
    expect(screen.getByText(/INITIALIZE ENCRYPTED VAULT/i)).toBeDefined();
  });

  it('should open Broadcast Modal upon clicking BROADCAST button', () => {
    render(<App />);

    const broadcastBtn = screen.getByText('BROADCAST');
    fireEvent.click(broadcastBtn);

    expect(screen.getByText(/PARALLEL BROADCAST EXECUTION/i)).toBeDefined();
  });
});
