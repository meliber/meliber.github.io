---
title: Use Openwrt VM as Router
date: 2024-01-10 21:36:30
tags:
---
OpenWrt is an open source linux system tailored for routers. Using an offical OpenWrt VM system as router has obvious benefits: enjoy the most flexibility of OpenWrt and get rid of the outdated vendor firmware.

<!-- more -->

## Environment and Hardware
The current router of home network has LAN IP 10.0.0.1. This router is going to be replaced by an OpenWrt virtual machine on Proxmox VE.
The Proxmox VE server is a fanless x64 mini pc with 4 * 2.5Gbps NICs with static IP 10.0.0.10. It is running with ZFS as its root file system.

## Set up
1. Set up an OpenWrt VM on the Proxmox VE server according to [this tutorial](https://i12bretro.github.io/tutorials/0405.html), set `start at boot` to `Yes` in the options of the VM. Expand root file system of OpenWrt by following [this tutorial](https://openwrt.org/docs/guide-user/advanced/expand_root) if you need to do so.
2. Create vmbr in Proxmox for every NIC.
3. Add four vmbrs into the OpenWrt VM. One for WAN, others for LAN.
4. Start the OpenWrt VM, use `ip addr` to check all NICs in the VM. Compare the MAC to the information in Proxmox host to figure out the correlation between NIC names and physical ethernet ports.
5. I prefer to use vim and git on OpenWrt to edit and keep tracks of configuration files. `less` is needed to display ANSI color properly when using `git diff`.
```ash install vim-full git less on OpenWrt
opkg update
opkg install vim-full git less
```
6. Before change any configuration in `/etc/config`, it's a good idea to init it as a git repository and make a commit for backup purpose.
7. Edit `/etc/config/network` to set WAN interface using DHCP, using your device name accordingly.
```conf
config interface 'wan'
    option device 'eth3'
    option proto 'dhcp'
```
8. Add LAN NICs to br-lan device, here I added eth0, eth1, eth2 to use as LAN ports.
```conf
config device
    option name 'br-lan'
    option type 'bridge'
    list ports 'eth0'
    list ports 'eth1'
    list ports 'eth2'
```
9. Set LAN ip address to match the network environment.
```conf
config interface 'lan'
    option device 'br-lan'
    option proto 'static'
    option netmask '255.255.248.0'
    option ip6assign '60'
    option ipaddr '10.0.0.1'
```
10. Add switch config.
```conf
config switch
    option name 'switch0'
    option reset '0'
    option enable_vlan '0'
```
## Switch to New Router
Connect the WAN cable to the port which bridged to the WAN port of OpenWrt on the Proxmox VE server, also connect other hosts, switch and AP device to the LAN ports of the Proxmox VE server.
You may need to connect your PC to the Proxmox VE server directly and set a static IP for your PC to use the Proxmox VE Web UI.
Restart the OpenWrt VM and the modem if neccessary. The OpenWrt VM should get WAN from your ISP and work as router of your network now.
If you are satisfied with your configuration, you can make a git commit of the `/etc/config` directory of OpenWrt and also make a snapshot of the OpenWrt VM on Proxmox VE.
