---
title: Migrate Openwrt VM to New Node
date: 2024-10-10 18:48:51
tags:
---
The Openwrt VM running in my fanless pc is the main router of home network. Recently I got a new router which has 6 NICs and a more powerful CPU. So I need to migrate the Openwrt VM to the new machine.

The basic idea of migration is backup the vm, move the omv file to the new machine, then restore it. Here are the steps for the whole process.

1. Install Proxmox VE on the new machine and set up all the network bridges.
2. Backup the Openwrt VM, move the backup file to the new Proxmox VE node, and restore the VM by following the official wiki [Backup_and_Restore](https://pve.proxmox.com/wiki/Backup_and_Restore).
3. On the new PVE node, remove the old network devices, then add new network devices according to the new hardware platform and Linux bridge setting.
4. Shut down the old Openwrt VM.
5. Start the new Openwrt VM, login to web ui. Update the device list for WAN and BR-LAN.
6. Connect the WAN cable to the designated NIC on the new PVE node, restart the VM and the modem if necessary. Then the new Openwrt VM should work good as router.
