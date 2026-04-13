import { useTranslation } from 'react-i18next';
import { TaskScheduleType, TaskChannel, TaskMode } from '../../types';

export interface PresetTaskData {
    name: string;
    prompt: string;
    scheduleType: TaskScheduleType;
    schedule: string;
    channel: TaskChannel;
    mode: TaskMode;
}

export const useTaskPresets = () => {
    const { t } = useTranslation();

    return [
        {
            label: t('scheduler.presets_data.morning'),
            icon: 'sun',
            data: { name: t('scheduler.presets_data.morning'), prompt: t('scheduler.presets_data.morning_prompt'), scheduleType: 'cron', schedule: '0 8 * * *', channel: 'telegram', mode: 'chat' } as PresetTaskData
        },
        {
            label: t('scheduler.presets_data.checkin'),
            icon: 'heartbeat',
            data: { name: t('scheduler.presets_data.checkin'), prompt: t('scheduler.presets_data.checkin_prompt'), scheduleType: 'interval', schedule: '60', channel: 'telegram', mode: 'chat' } as PresetTaskData
        },
        {
            label: t('scheduler.presets_data.journal'),
            icon: 'moon',
            data: { name: t('scheduler.presets_data.journal'), prompt: t('scheduler.presets_data.journal_prompt'), scheduleType: 'cron', schedule: '0 21 * * *', channel: 'telegram', mode: 'chat' } as PresetTaskData
        },
        {
            label: t('scheduler.presets_data.heartbeat'),
            icon: 'wave-square',
            data: { name: t('scheduler.presets_data.heartbeat'), prompt: t('scheduler.presets_data.heartbeat_prompt'), scheduleType: 'interval', schedule: '120', channel: 'telegram', mode: 'chat' } as PresetTaskData
        },
        {
            label: t('scheduler.presets_data.radar'),
            icon: 'rss',
            data: { name: t('scheduler.presets_data.radar'), prompt: t('scheduler.presets_data.radar_prompt'), scheduleType: 'cron', schedule: '0 9 * * *', channel: 'telegram', mode: 'agent' } as PresetTaskData
        },
        {
            label: t('scheduler.presets_data.system_report'),
            icon: 'server',
            data: { name: t('scheduler.presets_data.system_report'), prompt: t('scheduler.presets_data.system_report_prompt'), scheduleType: 'cron', schedule: '0 12 * * *', channel: 'telegram', mode: 'agent' } as PresetTaskData
        },
        {
            label: t('scheduler.presets_data.weather'),
            icon: 'cloud-sun',
            data: { name: t('scheduler.presets_data.weather'), prompt: t('scheduler.presets_data.weather_prompt'), scheduleType: 'cron', schedule: '0 7 * * *', channel: 'both', mode: 'agent' } as PresetTaskData
        },
        {
            label: t('scheduler.presets_data.weekly_plan'),
            icon: 'calendar-check',
            data: { name: t('scheduler.presets_data.weekly_plan'), prompt: t('scheduler.presets_data.weekly_plan_prompt'), scheduleType: 'cron', schedule: '0 18 * * 5', channel: 'telegram', mode: 'chat' } as PresetTaskData
        },
        {
            label: t('scheduler.presets_data.curiosity'),
            icon: 'lightbulb',
            data: { name: t('scheduler.presets_data.curiosity'), prompt: t('scheduler.presets_data.curiosity_prompt'), scheduleType: 'cron', schedule: '0 15 * * *', channel: 'telegram', mode: 'chat' } as PresetTaskData
        },
        {
            label: t('scheduler.presets_data.health_ping'),
            icon: 'leaf',
            data: { name: t('scheduler.presets_data.health_ping'), prompt: t('scheduler.presets_data.health_ping_prompt'), scheduleType: 'interval', schedule: '90', channel: 'ui', mode: 'chat' } as PresetTaskData
        }
    ];
};
