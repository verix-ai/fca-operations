import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ScannerErrorModal from '../ScannerErrorModal.jsx'

describe('ScannerErrorModal', () => {
  it('renders permission-denied copy', () => {
    render(<ScannerErrorModal error={{ kind: 'permission' }} onRetry={() => {}} onUseFilePicker={() => {}} />)
    expect(screen.getByText(/Camera access was blocked/i)).toBeInTheDocument()
  })

  it('renders unsupported-browser copy', () => {
    render(<ScannerErrorModal error={{ kind: 'unsupported' }} onRetry={() => {}} onUseFilePicker={() => {}} />)
    expect(screen.getByText(/doesn't support camera scanning/i)).toBeInTheDocument()
  })

  it('renders http-required copy', () => {
    render(<ScannerErrorModal error={{ kind: 'http' }} onRetry={() => {}} onUseFilePicker={() => {}} />)
    expect(screen.getByText(/secure \(HTTPS\) connection/i)).toBeInTheDocument()
  })

  it('renders no-camera copy', () => {
    render(<ScannerErrorModal error={{ kind: 'no-camera' }} onRetry={() => {}} onUseFilePicker={() => {}} />)
    expect(screen.getByText(/No camera was found/i)).toBeInTheDocument()
  })

  it('renders camera-busy copy', () => {
    render(<ScannerErrorModal error={{ kind: 'camera-busy' }} onRetry={() => {}} onUseFilePicker={() => {}} />)
    expect(screen.getByText(/being used by another app/i)).toBeInTheDocument()
  })

  it('renders generic copy as fallback', () => {
    render(<ScannerErrorModal error={{ kind: 'unknown' }} onRetry={() => {}} onUseFilePicker={() => {}} />)
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument()
  })

  it('calls onRetry when Try Again is clicked', async () => {
    const onRetry = vi.fn()
    render(<ScannerErrorModal error={{ kind: 'permission' }} onRetry={onRetry} onUseFilePicker={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /Try Again/i }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('calls onUseFilePicker when Use Upload File Instead is clicked', async () => {
    const onUseFilePicker = vi.fn()
    render(<ScannerErrorModal error={{ kind: 'permission' }} onRetry={() => {}} onUseFilePicker={onUseFilePicker} />)
    await userEvent.click(screen.getByRole('button', { name: /Use Upload File Instead/i }))
    expect(onUseFilePicker).toHaveBeenCalledOnce()
  })
})
