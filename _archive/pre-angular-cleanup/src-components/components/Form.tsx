import React from 'react';
import './Form.css';

/**
 * Input Component
 * Standard text input with label
 */
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  id,
  ...props
}) => {
  const inputId = id || `input-${Math.random()}`;

  return (
    <div className="form-group">
      {label && (
        <label htmlFor={inputId} className="form-label">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`form-input ${error ? 'error' : ''}`}
        {...props}
      />
      {error && <p className="form-error">{error}</p>}
      {hint && <p className="form-hint">{hint}</p>}
    </div>
  );
};

/**
 * Select Component
 * Dropdown select with label
 */
interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options?: SelectOption[];
  placeholder?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  options = [],
  placeholder = 'Select an option',
  id,
  ...props
}) => {
  const selectId = id || `select-${Math.random()}`;

  return (
    <div className="form-group">
      {label && (
        <label htmlFor={selectId} className="form-label">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`form-input ${error ? 'error' : ''}`}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
};

/**
 * Textarea Component
 * Multi-line text input
 */
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  error,
  hint,
  id,
  ...props
}) => {
  const textareaId = id || `textarea-${Math.random()}`;

  return (
    <div className="form-group">
      {label && (
        <label htmlFor={textareaId} className="form-label">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={`form-input form-textarea ${error ? 'error' : ''}`}
        {...props}
      />
      {error && <p className="form-error">{error}</p>}
      {hint && <p className="form-hint">{hint}</p>}
    </div>
  );
};

/**
 * Checkbox Component
 */
interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  error,
  id,
  ...props
}) => {
  const checkboxId = id || `checkbox-${Math.random()}`;

  return (
    <div className="form-group">
      <div className="checkbox-wrapper">
        <input
          id={checkboxId}
          type="checkbox"
          className={`form-checkbox ${error ? 'error' : ''}`}
          {...props}
        />
        {label && (
          <label htmlFor={checkboxId} className="form-label checkbox-label">
            {label}
          </label>
        )}
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
};

/**
 * Form Group Component
 * Wrapper for grouping form elements
 */
interface FormGroupProps {
  children: React.ReactNode;
  gap?: 'sm' | 'md' | 'lg';
}

export const FormGroup: React.FC<FormGroupProps> = ({ children, gap = 'md' }) => {
  const gapMap = {
    sm: 'var(--space-md)',
    md: 'var(--space-lg)',
    lg: 'var(--space-xl)',
  };

  return (
    <div
      className="form-group-wrapper"
      style={{ gap: gapMap[gap] }}
    >
      {children}
    </div>
  );
};

export default { Input, Select, Textarea, Checkbox, FormGroup };
