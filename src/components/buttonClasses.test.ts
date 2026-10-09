import { buttonClasses } from './buttonClasses'

describe('buttonClasses', () => {
  it('gives every variant a 44px+ target and no hard shadow', () => {
    expect(buttonClasses('secondary')).toContain('min-h-12')
    expect(buttonClasses('primary')).toContain('min-h-12')
    expect(buttonClasses('primary')).not.toContain('shadow-hard')
    expect(buttonClasses('secondary')).not.toContain('shadow-hard')
    expect(buttonClasses('primary', 'extra')).toContain('extra')
  })
})
