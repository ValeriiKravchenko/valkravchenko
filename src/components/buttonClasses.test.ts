import { buttonClasses } from './buttonClasses'

describe('buttonClasses', () => {
  it('gives every variant a 44px target and the primary one the hard shadow', () => {
    expect(buttonClasses('secondary')).toContain('min-h-11')
    expect(buttonClasses('primary')).toContain('shadow-hard')
    expect(buttonClasses('primary', 'extra')).toContain('extra')
  })
})
