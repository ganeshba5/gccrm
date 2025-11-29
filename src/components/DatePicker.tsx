import { useEffect, useRef } from 'react';
import flatpickr from 'flatpickr';
import 'flatpickr/dist/flatpickr.min.css';

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export default function DatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  disabled = false,
  className = '',
  id,
}: DatePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const flatpickrInstance = useRef<any>(null);
  const onChangeRef = useRef(onChange);

  // Keep onChange ref up to date
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (inputRef.current && !flatpickrInstance.current) {
      const instance = flatpickr(inputRef.current, {
        dateFormat: 'Y-m-d',
        defaultDate: value || undefined,
        onChange: (_selectedDates: Date[], dateStr: string) => {
          onChangeRef.current(dateStr);
        },
        disableMobile: false,
      });
      // flatpickr can return an array, but for single input it returns a single instance
      flatpickrInstance.current = Array.isArray(instance) ? instance[0] : instance;
    }

    return () => {
      if (flatpickrInstance.current) {
        if (Array.isArray(flatpickrInstance.current)) {
          flatpickrInstance.current.forEach((inst: any) => inst.destroy());
        } else {
          flatpickrInstance.current.destroy();
        }
        flatpickrInstance.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (flatpickrInstance.current) {
      const instance = Array.isArray(flatpickrInstance.current) 
        ? flatpickrInstance.current[0] 
        : flatpickrInstance.current;
      if (value) {
        instance.setDate(value, false);
      } else {
        instance.clear();
      }
    }
  }, [value]);

  useEffect(() => {
    if (flatpickrInstance.current && inputRef.current) {
      const instance = Array.isArray(flatpickrInstance.current) 
        ? flatpickrInstance.current[0] 
        : flatpickrInstance.current;
      if (disabled) {
        inputRef.current.disabled = true;
        instance.set('clickOpens', false);
      } else {
        inputRef.current.disabled = false;
        instance.set('clickOpens', true);
      }
    }
  }, [disabled]);

  return (
    <input
      ref={inputRef}
      type="text"
      id={id}
      placeholder={placeholder}
      disabled={disabled}
      readOnly
      className={className}
    />
  );
}

