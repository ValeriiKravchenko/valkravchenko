// Файловые операции раздела 8: ✎ дописывает суффикс (решение владельца В3), 🗑 и «создать файл»
// меняют только рабочий каталог.
import { describe, expect, it } from 'vitest'
import { createFile, deleteFile, editFile } from './appendixFileOps'
import { fresh, run } from './appendixProtocolKit'
import { ru } from '../locales/ru'

describe('✎ изменить', () => {
  it('дописывает суффикс из словаря перед концом файла: файл по-прежнему кончается переводом строки', () => {
    const s = editFile(fresh(), 'app.js')
    expect(s.working['app.js']).toBe(`console.log("v1");${ru.fileOps.editedSuffix}\n`)
    expect(s.working['README.md']).toBe('# Мини-сайт\n')
  })

  it('каждое нажатие дописывает ещё один суффикс; версий для app.js нет', () => {
    const s = editFile(editFile(fresh(), 'app.js'), 'app.js')
    expect(s.working['app.js']).toBe(`console.log("v1");${ru.fileOps.editedSuffix}${ru.fileOps.editedSuffix}\n`)
  })

  it('содержимое без перевода строки в конце получает суффикс в конец', () => {
    const s = fresh()
    expect(editFile({ ...s, working: { ...s.working, 'x.txt': 'abc' } }, 'x.txt').working['x.txt']).toBe(`abc${ru.fileOps.editedSuffix}`)
  })

  it('заметка в истории; индекс, коммиты и ветки не затронуты', () => {
    const before = fresh()
    const s = editFile(before, 'README.md')
    expect(s.history).toEqual([{ kind: 'note', text: ru.fileOps.editedNote('README.md') }])
    expect(s.index).toEqual(before.index)
    expect(s.commits).toEqual(before.commits)
    expect(s.branches).toEqual(before.branches)
    expect(s.reflog).toEqual(before.reflog)
  })

  it('файла нет — состояние не меняется, заметки нет', () => {
    const s = fresh()
    expect(editFile(s, 'nosuch.txt')).toBe(s)
  })

  it('git видит правку: status -s → « M app.js»; protocol: edit дописывает « + правка» перед концом строки (П8.21)', () => {
    expect(run(editFile(fresh(), 'app.js'), 'git status -s').result.output).toBe(' M app.js')
  })
})

describe('🗑 удалить из каталога', () => {
  it('убирает файл из рабочего каталога; индекс и HEAD не трогаются; git видит удаление', () => {
    const s = deleteFile(fresh(), 'README.md')
    expect(s.working).toEqual({ 'app.js': 'console.log("v1");\n' })
    expect(s.index['README.md']).toBeDefined()
    expect(s.history).toEqual([{ kind: 'note', text: ru.fileOps.deletedNote('README.md') }])
    expect(run(s, 'git status -s').result.output).toBe(' D README.md')
  })

  it('файла нет — состояние не меняется', () => {
    const s = fresh()
    expect(deleteFile(s, 'nosuch')).toBe(s)
  })
})

describe('создать файл', () => {
  it('создаёт файл с одной строкой «новый файл» и переводом строки; индекс не меняется; git видит неотслеживаемый файл', () => {
    const s = createFile(fresh(), 'x.txt')
    expect(s.working['x.txt']).toBe('новый файл\n')
    expect(s.index['x.txt']).toBeUndefined()
    expect(s.history).toEqual([{ kind: 'note', text: ru.fileOps.createdNote('x.txt') }])
    expect(run(s, 'git status -s').result.output).toBe('?? x.txt')
  })

  it('пробелы вокруг имени срезаются; пустое имя — ничего, даже заметки', () => {
    expect(createFile(fresh(), '  y.txt  ').working['y.txt']).toBe('новый файл\n')
    const s = fresh()
    expect(createFile(s, '')).toBe(s)
    expect(createFile(s, '   ')).toBe(s)
  })

  it('занятое имя — файл не затирается, только заметка', () => {
    const s = createFile(fresh(), 'app.js')
    expect(s.working['app.js']).toBe('console.log("v1");\n')
    expect(s.history).toEqual([{ kind: 'note', text: ru.fileOps.duplicateNote('app.js') }])
  })

  it('недопустимые имена (каталог, пробел, кириллица, точка или дефис в начале, слишком длинное) — только заметка', () => {
    for (const name of ['dir/x.txt', 'a b.txt', 'файл.txt', '.hidden', '-x', '..', 'x'.repeat(65)]) {
      const s = createFile(fresh(), name)
      expect(s.working, name).toEqual(fresh().working)
      expect(s.history, name).toEqual([{ kind: 'note', text: ru.appendix.fileOps.invalidName(name.trim()) }])
    }
  })

  it('допустимые имена: буквы, цифры, точка, дефис, подчёркивание', () => {
    for (const name of ['a', 'A1', '1.txt', 'my-file_2.md', 'x'.repeat(64)]) expect(createFile(fresh(), name).working[name], name).toBe('новый файл\n')
  })
})
