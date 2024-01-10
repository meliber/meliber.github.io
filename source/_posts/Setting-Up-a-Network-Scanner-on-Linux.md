---
title: Setting Up a Network Scanner on Linux
date: 2024-01-09 14:22:41
author: Adam Han
tags:
---

I have used my network scanner through Windows for a long time. It works well except I need to get a Windows laptop. Although the default storage path of the scanner resides in a samba server, it is still tedious to do daily scan. I managed to set it up on Linux. This blog is for my reference.

## Device and system
The scanner is [Canon MF113w](https://www.canon.ca/en/product?name=imageCLASS_MF113w&category=/en/products/Printers/Office-Printers/Small-Office-and-Home-Office/Black---White-Printers). The OS of my desktop is Arch Linux. Home network is managed by OpenWrt.

## Basic setup
Linux uses [SANE](http://www.sane-project.org/) to communicate with scanners. Install `sane` as a backend and `simple-scan` as a frontend utility.
```bash Install sane and simple-scan
sudo pacman -Sy sane simple-scan
```
According to the [README](https://github.com/alexpevzner/sane-airscan) of `sane-airscan`, Canon MF110/910 can only work in eSCL mode. The [man page of sane-escl](https://man.archlinux.org/man/extra/sane/sane-escl.5.en) states that *"eSCL devices that announce themselves on mDNS as _uscan.utcp or _uscans._utcp. If the device is available, the sane-escl backend recovers these capacities"*. 
```bash Read the man page of sane-escl through CLI
man 5 sane-escl
```
In order to use Avahi for multicastDNS service discovery, I choose to install `avahi` package. First the mutlicastDNS of systemd should be disabled to avoid conflict.
Read the man page of systemd-resolved
```bash
man 5 resolved.conf
```
and set `MulticastDNS=no` in `/etc/systemd/resolved.conf`, then restart `systemd-resolved` service.
```bash
sudo systemctl restart systemd-resolved
```
Install `avahi nss-mdns`:
```bash
sudo pacman -S avahi nss-mdns
```
Then set `hosts` entry of `/etc/nsswitch.conf` with the value:
```conf
hosts: files mymachines resolve [!UNAVAIL=continue] myhostname dns mdns [NOTFOUND=return]
```
Start the avahi-daemon service:
```bash
sudo systemctl enable --now avahi-daemon.service
```
The `avahi-daemon.service` can be triggered by `avahi-daemon.socket`. So enable the socket and disable the service could be a better practice.

## Trouble shooting
The `sane` package on Arch Linux contains a cli tool `scanimage`. After the basic setup, `scanimage -L` should list the scanner. However I encountered some problems.

### custom TLD
I used `.home` as TLD instead of `.local` in home network. To deal with the TLD, `/etc/nsswitch.conf` used `mdns` instead of `mdns_minimal` because [the `mdns_minimal` module handles queries for the `.local` TLD only](https://wiki.archlinux.org/title/avahi#Configuring_mDNS_for_custom_TLD).
Since `home` is configured as the domain for LAN network, I set `domain-name=home` in `/etc/avahi/avahi-daemon.conf`.  This is the root cause of the problem that avahi can't discover service.

When`avahi-browse --all --ignore-local --resolve --terminate` was running to list services, I monitored the mdns traffic by wireshark
```bash
sudo tshark -i enp176s0 -f "udp port 5353"
```
 During this process, `avahi-browse` still got no outputs. But I got a reponse from wireshark:
 ```
 1493 10840.052424716    10.0.7.76 → 224.0.0.251  MDNS 124 Standard query 0x0000 PTR _companion-link._tcp.local, "QM" question PTR _rdlink._tcp.local, "QM"
question PTR _sleep-proxy._udp.local, "QM" question`
 MDNS 394 Standard query response 0x0000 PTR amzn.dmgr:*:*:612333._amzn-wplay._tcp.local PTR amzn.dmgr:*:*:612333._amzn-wplay._tcp.local SRV, cache flush 0 0 39474 amazon-*-home.local TXT, cache flush`
As we can see, it is a response of mDNS query from `amazon-*-home.local`. Pay attention to the "-home.local" part. As "home" is the domain of LAN network, the hostname should be `amazon-*.home
```
So, I checked the host name, `avahi-resolve-host-name amazon-*-home.local` and got the right ip:
```
amazon-*-home.local     10.0.7.85
```
But I can't ping this hostname:
```
ping amazon-*-home.local
ping: amazon-*-home.local: Name or service not known
```
or try this:
```
ping amazon-*-home
ping: amazon-*-home: Name or service not known
```
However, I can do this:
```
ping amazon-*
PING amazon-*.home (10.0.7.85) 56(84) bytes of data.
64 bytes from amazon-*.home (10.0.7.85): icmp_seq=1 ttl=64 time=130 ms
```
or
```
ping amazon-*.home
PING amazon-*.home (10.0.7.85) 56(84) bytes of data.
64 bytes from amazon-*.home (10.0.7.85): icmp_seq=1 ttl=64 time=165 ms
```

So, even `.home` is the domain of the home network, the avahi service broadcast may be hard coded to use `.local`. This should be the root of all these quirks.

I commented out `domain-name=home` in `/etc/avahi/avahi-daemon.conf`, reverted back to the default `domain-name=local`. And, `avahi-browse --all --ignore-local --resolve --terminate` got all the services.

### Intermittent connection failure
The scanner is set static IPv4 and IPv6 with DHCP through its console. Sometimes when I start `simple-scan`, I get errors that `simple-scan` cannot connect to the scanner. Running `scanimage -L` can see the scanner is online with its IPv4 address. However, if I run `scanimage -L` again, the scanner is listed with its IPv6 address. 

This dual stack IP addresses cause the connection problem between `simple-scan` and the scanner. `simple-scan` works well after I disabled IPv6 through the console of the scanner.

### Speed up scanner discovery 
There are many backends list in the `/etc/sane.d/dll.conf` file. For my eSCL scanner, commenting out all lines of this file except `escl` can speed up the scanner discovery process.

## Reference
1. [Arch Linux Wiki: sane](https://wiki.archlinux.org/title/SANE)
2. [Arch Linux Wiki: avahi](https://wiki.archlinux.org/title/avahi)
