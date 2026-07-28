package utils

import (
	"crypto/sha256"
	"encoding/hex"
	"net"
	"sort"
)

// MachineFingerprint derives a stable per-device ID from the local network
// interfaces' MAC addresses — no OS-specific registry/syscall code, no extra
// dependency. Only meaningful when this backend runs ON the customer's
// machine (the Tauri desktop sidecar); a cloud-hosted deployment would just
// fingerprint the server, which is why callers must gate this behind
// DEPLOYMENT_MODE=desktop rather than calling it unconditionally.
func MachineFingerprint() (string, error) {
	ifaces, err := net.Interfaces()
	if err != nil {
		return "", err
	}
	var macs []string
	for _, iface := range ifaces {
		// Skip loopback/virtual-down interfaces — their MACs are either absent
		// or shared across every machine, useless as an identifier.
		if iface.Flags&net.FlagLoopback != 0 || len(iface.HardwareAddr) == 0 {
			continue
		}
		macs = append(macs, iface.HardwareAddr.String())
	}
	if len(macs) == 0 {
		return "", errNoInterfaces
	}
	sort.Strings(macs) // stable order regardless of OS enumeration order
	h := sha256.New()
	for _, m := range macs {
		h.Write([]byte(m))
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

var errNoInterfaces = &fingerprintError{"no non-loopback network interface found to derive a machine fingerprint"}

type fingerprintError struct{ msg string }

func (e *fingerprintError) Error() string { return e.msg }
