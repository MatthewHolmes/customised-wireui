import FluentDate from '@/utils/date'
import { Focusable, Positionable, Entangleable } from '@/alpine/modules'
import { CalendarConfig, Day, Tab } from './interfaces'
import { AlpineComponent } from '@/components/alpine2'
import { AlpineModel, WireModel } from '@/components/alpine'
import {
  Events,
  MonthSelector,
  YearsSelector,
  Calendar,
  Rollback,
  Watchers,
} from '@/components/date-picker/features'

export default class DatetimePicker extends AlpineComponent {
  declare $refs: {
    popover: HTMLElement
    timesContainer: HTMLElement
    container: HTMLDivElement
    optionsContainer: HTMLDivElement
    rawInput: HTMLInputElement
  }

  declare $props: {
    config: {
      requiresConfirmation: boolean
      readonly: boolean
      disabled: boolean
    }
    timezone: {
      enabled: boolean
      server: string
      user: string|null
    }
    calendar: {
      multiple: {
        enabled: boolean
        max: number
      }
      weekDays: string[]
      startOfWeek: number
      monthNames: string[]
      min: string|null
      max: string|null
      allowedDates: string[]|string[][]
      disabled: {
        years: number[]|number[][]
        months: number[]
        weekdays: number[]
        dates: string[]|string[][]
        pastDates: boolean|string
      }
    }
    timePicker: {
      enabled: boolean
      interval: number
      is12H: boolean
      min: string|number
      max: string|number
    }
    input: {
      parseFormat: string
      displayFormat: string|null
    }
    wireModel: WireModel
    alpineModel: AlpineModel
    dateFormatPreference: number  // 0 = international, 1 = US
  }

  localTimezone: string = FluentDate.getLocalTimezone()

  calendar: CalendarConfig = {
    dates: [],
    years: [],
    month: FluentDate.now().getMonth(),
    year: FluentDate.now().getYear(),
  }

  declare features: {
    monthSelector: MonthSelector
    yearsSelector: YearsSelector
    calendar: Calendar
    rollback: Rollback
    watchers: Watchers
  }

  tab: Tab = 'calendar'

  $events = new Events()

  positionable = new Positionable()

  focusable = new Focusable()

  entangleable = new Entangleable<FluentDate|FluentDate[]>()

  time: string|null = null

  get dateFormat (): string {
    if (this.$props.input.parseFormat) {
      return this.$props.input.parseFormat
    }

    if (this.$props.calendar.multiple.enabled) {
      return 'YYYY-MM-DD'
    }

    return this.$props.timePicker.enabled
      ? 'YYYY-MM-DDTHH:mm:ss'
      : 'YYYY-MM-DD'
  }

  get selectedDates (): FluentDate[] {
    if (this.$props.calendar.multiple.enabled) {
      const dates = this.entangleable.get() ?? []

      if (Array.isArray(dates)) {
        return dates
      }
    }

    return []
  }

  get selected (): FluentDate|null {
    const date = this.entangleable.get()

    return date instanceof FluentDate
      ? date
      : null
  }

  get selectedRawValue (): string {
    if (this.$props.calendar.multiple.enabled) {
      return JSON.stringify(this.selectedDates.map(date => date.format(this.dateFormat)))
    }

    return this.selected?.format(this.dateFormat) ?? ''
  }

  get localeDateConfig (): Intl.DateTimeFormatOptions {
    const config: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      timeZone: this.localTimezone,
    }

    if (this.$props.timePicker.enabled) {
      config.hour = 'numeric'
      config.minute = 'numeric'
    }

    return config
  }

  get display (): string|null {
    if (this.$props.calendar.multiple.enabled) {
      return this.selectedDates.length ? ' ' : null
    }

    if (this.selected) {
      return this.$props.input.displayFormat
        ? this.selected.format(this.$props.input.displayFormat)
        : this.selected.getNativeDate().toLocaleString(navigator.language, this.localeDateConfig)
    }

    return null
  }

  get selectedDatesDisplay (): string[] {
    const config: Intl.DateTimeFormatOptions = {
      year: undefined,
      month: undefined,
      day: 'numeric',
      timeZone: this.localTimezone,
    }

    const hasMultipleYears = new Set(this.selectedDates.map(date => date.getYear())).size > 1
    const hasMultipleMonths = new Set(this.selectedDates.map(date => date.getMonth())).size > 1

    if (hasMultipleYears) {
      config.year = 'numeric'
      config.month = 'numeric'
    }

    if (hasMultipleMonths) {
      config.month = 'numeric'
    }

    return this.selectedDates.map(date => {
      return date.getNativeDate().toLocaleString(navigator.language, config)
    })
  }

  get weekDays (): string[] {
    const weekDays = this.$props.calendar.weekDays
    const startOfWeek = this.$props.calendar.startOfWeek

    if (startOfWeek === 0) {
      return this.$props.calendar.weekDays
    }

    return weekDays.slice(startOfWeek).concat(weekDays.slice(0, startOfWeek))
  }

  get isMaxMultipleReached () {
    return this.$props.calendar.multiple.enabled
      && this.$props.calendar.multiple.max > 0
      && this.selectedDates.length >= this.$props.calendar.multiple.max
  }

  init () {
    if (this.$props.timezone.user) {
      FluentDate.setLocalTimezone(this.$props.timezone.user)
      this.localTimezone = this.$props.timezone.user
    }

    this.positionable
      .start(this, this.$refs.container, this.$refs.popover)
      .position('bottom')

    this.positionable.watch(state => {
      this.$events.dispatch('popover', state)

      if (state) {
        this.tab = 'calendar'
      }
    })

    this.focusable.start(this.$refs.optionsContainer, 'button, input')

    this.setup()
  }

  setup () {
    this.features = {
      monthSelector: new MonthSelector(this),
      yearsSelector: new YearsSelector(this),
      calendar: new Calendar(this),
      rollback: new Rollback(this),
      watchers: new Watchers(this),
    }
  }

  clear () {
    this.entangleable.clear()

    this.$events.dispatch('clear')
  }

  cancel () {
    this.$events.dispatch('cancel')

    this.positionable.close()
  }

  toggleTab (tab: Tab) {
    if (this.tab === tab) {
      return (this.tab = 'calendar')
    }

    this.tab = tab
  }

  selectDay (day: Day) {
    this.releaseActiveElementBlur()

    if (this.$props.calendar.multiple.enabled) {
      return this.toggleSelectedDay(day)
    }

    const date = new FluentDate(day.date)

    if (this.$props.timePicker.enabled) {
      if (this.selected) {
        this.time = this.selected.getTime()

        date.setTime(this.time)
      }
    }

    this.entangleable.set(date)
    this.calendar.year = day.year
    this.calendar.month = day.month

    this.$events.dispatch('selected::day', day)

    if (this.$props.timePicker.enabled) {
      return this.tab = 'time-picker'
    }

    if (!this.$props.config.requiresConfirmation) {
      this.positionable.close()
    }
  }

  private toggleSelectedDay (day: Day) {
    const dates = this.entangleable.get() as FluentDate[]
    const date = new FluentDate(day.date)
    const index = dates.findIndex(selected => selected.isSame(date, 'date'))
    const shouldSelect = index === -1 && !this.isMaxMultipleReached
    const shouldRemove = index !== -1

    if (shouldSelect) {
      dates.push(date)
    }

    if (shouldRemove) {
      dates.splice(index, 1)
    }

    this.entangleable.set(dates, { force: true })

    this.$events.dispatch('selected::day', day)
  }

  removeSelectedDate (index: number) {
    this.releaseActiveElementBlur()

    const dates = this.entangleable.get() as FluentDate[]

    dates.splice(index, 1)

    this.entangleable.set(dates, { force: true })
  }

  selectMonth (month: number) {
    this.calendar.month = month

    this.tab = 'calendar'

    this.$events.dispatch('selected::month', this.calendar.year, month)
  }

  selectYear (year: number) {
    this.calendar.year = year

    this.tab = 'calendar'

    this.$events.dispatch('selected::year', year)
  }

  previous () {
    this.$events.dispatch('previous')
  }

  next () {
    this.$events.dispatch('next')
  }

  goToday () {
    const now = FluentDate.now()

    this.calendar.year = now.getYear()
    this.calendar.month = now.getMonth()

    this.tab = 'calendar'

    this.$events.dispatch('selected::month', now.getYear(), now.getMonth())
  }

  shouldShowFooter () {
    return this.$props.config.requiresConfirmation
      || this.$props.calendar.multiple.enabled
  }

  fluentDateToDay (date: FluentDate): Day {
    return {
      date: date.toDateString(),
      year: date.getYear(),
      month: date.getMonth(),
      number: date.getDay(),
      isDisabled: this.isDisabled(date),
      isToday: date.isToday(),
      isSelected: this.isSelected(date),
      isSelectedMonth: date.getMonth() === this.calendar.month,
    }
  }

  releaseActiveElementBlur (): void {
    if (document.activeElement) {
      (document.activeElement as HTMLElement).blur()
    }
  }

  isSelected (day: FluentDate): boolean {
    if (this.$props.calendar.multiple.enabled) {
      return this.selectedDates.some(date => date.isSame(day, 'day'))
    }

    return Boolean(this.selected?.isSame(day, 'day'))
  }

  isDisabled (day: FluentDate): boolean {
    const allowedDates = this.$props.calendar.allowedDates

    if (allowedDates.length) {
      return !allowedDates.some((date: string|string[]) => {
        if (date instanceof Array) {
          return day.isBetween(date[0], date[1])
        }

        return day.isSame(date, 'day')
      })
    }

    const disabled = this.$props.calendar.disabled

    if (disabled.pastDates) {
      if (typeof disabled.pastDates === 'boolean') {
        return day.isBefore(FluentDate.now(), 'day')
      }

      return day.isSameOrBefore(disabled.pastDates, 'day')
    }

    if (disabled.dates.length) {
      return disabled.dates.some((date: string|string[]) => {
        if (date instanceof Array) {
          return day.isBetween(date[0], date[1])
        }

        return day.isSame(date, 'day')
      })
    }

    if (disabled.months.length) {
      return disabled.months.includes(day.getRealMonth())
    }

    if (disabled.years.length) {
      return disabled.years.some((year: number|number[]) => {
        if (year instanceof Array) {
          return day.getYear() >= year[0] && day.getYear() <= year[1]
        }

        return day.getYear() === year
      })
    }

    if (disabled.weekdays.length && disabled.weekdays.includes(day.getDayOfWeek())) {
      return true
    }

    const { min, max } = this.$props.calendar

    if (min && max) return !day.isBetween(min, max)
    if (min) return day.isBefore(min, 'day')
    if (max) return day.isAfter(max, 'day')

    return false
  }

// Add this method to the DatetimePicker class in:
// vendor/wireui/wireui/ts/components/date-picker/index.ts

// Add this method anywhere in the DatetimePicker class (after the existing methods):

handleManualInput(value: string): void {
  
  if (!value || !value.trim()) {
    this.clear()
    return
  }

  try {
    // Parse the input value more carefully, avoiding timezone issues
    let inputDate: FluentDate
    
    try {
      // For date-only inputs, ensure we create the date in local time
      if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
        // ISO date format without time - create in local timezone to avoid UTC conversion
        const [year, month, day] = value.trim().split('-').map(Number)
        const localDate = new Date(year, month - 1, day) // month is 0-indexed in JS Date
        inputDate = new FluentDate(localDate, this.localTimezone)
      } else {
        // First try parsing with the configured format
        inputDate = new FluentDate(value.trim(), this.localTimezone, this.dateFormat)
      }
    } catch (error) {
      // If that fails, try parsing based on the configured format
      try {
        const trimmed = value.trim()
        
        let localDate: Date
        
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
          // YYYY-MM-DD
          const [year, month, day] = trimmed.split('-').map(Number)
          localDate = new Date(year, month - 1, day)
        } else if (/^\d{1,2}\/\d{1,2}\/\d{4}(\s+\d{1,2}:\d{2}(:\d{2})?)?$/.test(trimmed)) {
          // Handle DD/MM/YYYY [HH:mm:ss] vs MM/DD/YYYY [HH:mm:ss] based on dateFormatPreference
          const parts = trimmed.split(' ')
          const datePart = parts[0]
          const timePart = parts[1] || '00:00:00'
          
          const [first, second, year] = datePart.split('/').map(Number)
          
          if (this.$props.dateFormatPreference === 1) {
            // US format: MM/DD/YYYY
            localDate = new Date(year, first - 1, second)
          } else {
            // International format: DD/MM/YYYY
            localDate = new Date(year, second - 1, first)
          }
          
          // Add time if provided
          if (timePart && timePart !== '00:00:00') {
            const timeComponents = timePart.split(':')
            const hours = parseInt(timeComponents[0]) || 0
            const minutes = parseInt(timeComponents[1]) || 0
            const seconds = parseInt(timeComponents[2]) || 0
            
            localDate.setHours(hours, minutes, seconds)
          }
        } else if (/^\d{1,2}-\d{1,2}-\d{4}(\s+\d{1,2}:\d{2}(:\d{2})?)?$/.test(trimmed)) {
          // Handle DD-MM-YYYY [HH:mm:ss] vs MM-DD-YYYY [HH:mm:ss] based on dateFormatPreference
          const parts = trimmed.split(' ')
          const datePart = parts[0]
          const timePart = parts[1] || '00:00:00'
          
          const [first, second, year] = datePart.split('-').map(Number)
          
          if (this.$props.dateFormatPreference === 1) {
            // US format: MM-DD-YYYY
            localDate = new Date(year, first - 1, second)
          } else {
            // International format: DD-MM-YYYY
            localDate = new Date(year, second - 1, first)
          }
          
          // Add time if provided
          if (timePart && timePart !== '00:00:00') {
            const timeComponents = timePart.split(':')
            const hours = parseInt(timeComponents[0]) || 0
            const minutes = parseInt(timeComponents[1]) || 0
            const seconds = parseInt(timeComponents[2]) || 0
            
            localDate.setHours(hours, minutes, seconds)
          }
        } else if (/^\d{1,2}\/\d{1,2}\/\d{4}(\s+\d{1,2}:\d{2}(\s?[APap][Mm])?)?$/i.test(trimmed)) {
            const parts = trimmed.split(' ')
            const datePart = parts[0]
            const timePart = parts[1] || '00:00:00'
            const meridiem = parts[2]
            
            const [first, second, year] = datePart.split('/').map(Number)
            
            if (this.$props.dateFormatPreference === 1) {
              // US format: MM/DD/YYYY
              localDate = new Date(year, first - 1, second)
            } else {
              // International format: DD/MM/YYYY
              localDate = new Date(year, second - 1, first)
            }
     
            // Add time if provided
            if (timePart && timePart !== '00:00:00') {
              const timeComponents = timePart.split(':')
              let hours = parseInt(timeComponents[0]) || 0
              const minutes = parseInt(timeComponents[1]) || 0
              const seconds = parseInt(timeComponents[2]) || 0
             
              // Handle AM/PM conversion
              if (meridiem && /am/i.test(meridiem)) {
                // AM: 12:xx AM becomes 0:xx, everything else stays the same
                if (hours === 12) {
                  hours = 0
                }
              } else if (meridiem && /pm/i.test(meridiem)) {
                // PM: 12:xx PM stays 12:xx, everything else adds 12
                if (hours !== 12) {
                  hours += 12
                }
              }
              
              localDate.setHours(hours, minutes, seconds)
            }

        } else {
          // Fallback to native parsing but ensure local time
          const nativeDate = new Date(trimmed)
          if (isNaN(nativeDate.getTime())) {
            console.warn('Invalid date entered:', value)
            return
          }
          localDate = new Date(nativeDate.getFullYear(), nativeDate.getMonth(), nativeDate.getDate())
        }

        inputDate = new FluentDate(localDate, this.localTimezone)
      } catch (error2) {
        console.warn('Invalid date entered:', value)
        return
      }
    }
    
    // Validate the date
    if (!inputDate.isValid()) {
      console.warn('Invalid date entered:', value)
      return
    }

    // Check if the date is disabled
    if (this.isDisabled(inputDate)) {
      console.warn('Date is disabled:', value)
      return
    }

    if (this.$props.calendar.multiple.enabled) {
      // Handle multiple date selection
      const dates = this.entangleable.get() as FluentDate[] || []
      
      // Check if date already exists
      const exists = dates.some(date => date.isSame(inputDate, 'day'))
      
      if (!exists && !this.isMaxMultipleReached) {
        dates.push(inputDate)
        this.entangleable.set(dates, { force: true })
      }
    } else {
      // Single date selection
      if (this.$props.timePicker.enabled && this.selected) {
        // Only preserve existing time if user didn't type a time component
        const userTypedTime = value.trim().includes(':')
        
        if (!userTypedTime) {
          // Preserve existing time if no time was typed
          const existingTime = this.selected.getTime()
          inputDate.setTime(existingTime)
        }
        // If user typed time, keep the time they typed (already set in inputDate)
      }
      
      this.entangleable.set(inputDate)
      
      // Update calendar view to show the selected date's month/year
      this.calendar.year = inputDate.getYear()
      this.calendar.month = inputDate.getMonth()
    }

    this.$events.dispatch('selected::day', {
      date: inputDate.toDateString(),
      year: inputDate.getYear(),
      month: inputDate.getMonth(),
      number: inputDate.getDay(),
      isDisabled: false,
      isToday: inputDate.isToday(),
      isSelected: true,
      isSelectedMonth: true,
    })
    
  } catch (error) {
    console.error('Error parsing manual date input:', error)
  }
}

}