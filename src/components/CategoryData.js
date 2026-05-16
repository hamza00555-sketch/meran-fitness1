export const COMMITMENT_CATEGORIES = [
  { id: 'rent',         label: 'إيجار',      emoji: '🏠', color: '#6C63FF', bg: 'rgba(108,99,255,.18)' },
  { id: 'bills',        label: 'فواتير',     emoji: '📑', color: '#FFB830', bg: 'rgba(255,184,48,.18)' },
  { id: 'electricity',  label: 'كهرباء',     emoji: '⚡', color: '#FFD60A', bg: 'rgba(255,214,10,.18)' },
  { id: 'internet',     label: 'إنترنت',     emoji: '📡', color: '#00C9A7', bg: 'rgba(0,201,167,.18)' },
  { id: 'subscription', label: 'اشتراك',     emoji: '📱', color: '#FF6B9D', bg: 'rgba(255,107,157,.18)' },
  { id: 'gym',          label: 'جيم',        emoji: '🏋️', color: '#FF8C42', bg: 'rgba(255,140,66,.18)' },
  { id: 'installment',  label: 'قسط',        emoji: '💳', color: '#A78BFA', bg: 'rgba(167,139,250,.18)' },
  { id: 'other',        label: 'أخرى',       emoji: '📌', color: '#9B99C8', bg: 'rgba(155,153,200,.18)' },
];

export const EXPENSE_CATEGORIES = [
  { id: 'food',          label: 'طعام',        emoji: '🍽️', color: '#FF8C42', bg: 'rgba(255,140,66,.18)' },
  { id: 'coffee',        label: 'قهوة',        emoji: '☕',  color: '#C8956C', bg: 'rgba(200,149,108,.18)' },
  { id: 'transport',     label: 'مواصلات',     emoji: '🚌', color: '#00C9A7', bg: 'rgba(0,201,167,.18)' },
  { id: 'fuel',          label: 'بنزين',       emoji: '⛽', color: '#FFB830', bg: 'rgba(255,184,48,.18)' },
  { id: 'shopping',      label: 'تسوق',        emoji: '🛍️', color: '#FF6B9D', bg: 'rgba(255,107,157,.18)' },
  { id: 'health',        label: 'صحة',         emoji: '❤️', color: '#FF6B6B', bg: 'rgba(255,107,107,.18)' },
  { id: 'entertainment', label: 'ترفيه',       emoji: '🎬', color: '#6C63FF', bg: 'rgba(108,99,255,.18)' },
  { id: 'other',         label: 'أخرى',        emoji: '📌', color: '#9B99C8', bg: 'rgba(155,153,200,.18)' },
];

export const GOAL_CATEGORIES = [
  { id: 'travel',       label: 'سفر',         emoji: '✈️', color: '#00C9A7', bg: 'rgba(0,201,167,.18)' },
  { id: 'car',          label: 'سيارة',        emoji: '🚗', color: '#6C63FF', bg: 'rgba(108,99,255,.18)' },
  { id: 'electronics',  label: 'إلكترونيات',   emoji: '💻', color: '#FFB830', bg: 'rgba(255,184,48,.18)' },
  { id: 'emergency',    label: 'طوارئ',        emoji: '🛡️', color: '#FF6B6B', bg: 'rgba(255,107,107,.18)' },
  { id: 'education',    label: 'تعليم',        emoji: '🎓', color: '#A78BFA', bg: 'rgba(167,139,250,.18)' },
  { id: 'home',         label: 'منزل',         emoji: '🏠', color: '#FF8C42', bg: 'rgba(255,140,66,.18)' },
  { id: 'other',        label: 'أخرى',         emoji: '🎯', color: '#9B99C8', bg: 'rgba(155,153,200,.18)' },
];

export function getCatData(list, id) {
  return list.find(c => c.id === id) || list[list.length - 1];
}
