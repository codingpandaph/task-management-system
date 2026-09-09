import type { ReactElement } from 'react';

export interface Field {
  name: string;
  label: string;
  type?: string;
  optional?: boolean;
  value?: string | number;
  options?: { value: string; label: string }[];
  multiple?: boolean;
  showWhen?: { field: string; values: string[] };
}

export interface FormResult {
  close?: boolean;
  notice?: string;
}

export interface SubmitAction {
  label: string;
  value: string;
  variant?: 'text' | 'outlined' | 'contained';
  color?: 'primary' | 'error';
  icon?: ReactElement;
}
