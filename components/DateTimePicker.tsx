import React from 'react';
import { Platform } from 'react-native';
import DateTimePickerNative from '@react-native-community/datetimepicker';

interface DateTimePickerProps {
  value: Date;
  mode: 'date' | 'time' | 'datetime';
  display?: 'default' | 'spinner' | 'calendar' | 'clock';
  onChange: (event: any, selectedDate?: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
}

/** "YYYY-MM-DD" in LOCAL time. toISOString() is UTC, which shows the previous
 *  day for any timezone ahead of UTC (e.g. India). */
function toLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const DateTimePicker: React.FC<DateTimePickerProps> = ({
  value,
  mode,
  display = 'default',
  onChange,
  minimumDate,
  maximumDate,
}) => {
  if (Platform.OS === 'web') {
    // For web, use the native HTML date input
    return (
      <input
        type={mode === 'time' ? 'time' : 'date'}
        value={mode === 'time' ? value.toTimeString().slice(0, 5) : toLocalYMD(value)}
        min={mode !== 'time' && minimumDate ? toLocalYMD(minimumDate) : undefined}
        max={mode !== 'time' && maximumDate ? toLocalYMD(maximumDate) : undefined}
        onChange={(e) => {
          const raw = e.target.value;
          if (!raw) return;

          let newDate: Date;

          if (mode === 'time') {
            // raw is "HH:MM" — build a Date from today with those hours/minutes
            const [hours, minutes] = raw.split(':').map(Number);
            newDate = new Date();
            newDate.setHours(hours, minutes, 0, 0);
          } else {
            // raw is "YYYY-MM-DD" — parse as local date to avoid TZ shift
            const [year, month, day] = raw.split('-').map(Number);
            newDate = new Date(year, month - 1, day);
          }

          if (!isNaN(newDate.getTime())) {
            onChange({ type: 'set' }, newDate);
          }
        }}
        style={{
          padding: 10,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: '#D1D5DB',
          fontSize: 16,
          width: '100%',
          boxSizing: 'border-box',
          marginTop: 8,
        }}
      />
    );
  }

  // For native platforms, use the native date picker
  return (
    <DateTimePickerNative
      value={value}
      mode={mode}
      display={display}
      onChange={onChange}
      minimumDate={minimumDate}
      maximumDate={maximumDate}
    />
  );
};

export default DateTimePicker;
