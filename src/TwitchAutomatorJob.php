<?php

declare(strict_types=1);

namespace App;

use GuzzleHttp\Client;
use Symfony\Component\Process\Process;

class TwitchAutomatorJob
{

	const NO_FILE = 1;
	const NO_DATA = 2;

	public $name;
	public $pid;
	public $pidfile;
	public $pidfile_simple;
	public $metadata;
	public $status;
	public $error;
	private $tried_loading;

	function __construct(string $name)
	{
		$this->name = $name;
		$this->pidfile = TwitchHelper::$pids_folder . DIRECTORY_SEPARATOR . $name . '.json';
		$this->pidfile_simple = TwitchHelper::$pids_folder . DIRECTORY_SEPARATOR . $name . '.pid';
		return $this;
	}

	function load()
	{
		$tried_loading = true;
		if (!file_exists($this->pidfile)) {
            TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Loading job {$this->name} failed, no json file", $this->metadata);
			return $this->loadSimple();
			// $this->error = TwitchAutomatorJob::NO_FILE;
			// return false;
		}
		$raw = file_get_contents($this->pidfile);
		if (!$raw) {
			$this->error = TwitchAutomatorJob::NO_DATA;
			return false;
		}
		$data = json_decode($raw);
		$this->pid = $data->pid;

		$this->getStatus();
	}

	function loadSimple()
	{
		$tried_loading = true;
		if (!file_exists($this->pidfile_simple)) {
            TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Loading job {$this->name} failed, no pid file", $this->metadata);
			$this->error = TwitchAutomatorJob::NO_FILE;
			return false;
		}
		$raw = file_get_contents($this->pidfile_simple);
		if (!$raw) {
			$this->error = TwitchAutomatorJob::NO_DATA;
			return false;
		}
		$this->pid = $raw;
		$this->getStatus();
	}

	function save()
	{
		file_put_contents($this->pidfile, json_encode($this));
		TwitchHelper::log(TwitchHelper::LOG_INFO, "Save job {$this->name} with PID {$this->pid}", $this->metadata);
	}

	function clear()
	{
		if($this->process){
			$this->process = null;
		}
		
		if (file_exists($this->pidfile)) {
			TwitchHelper::log(TwitchHelper::LOG_INFO, "Clear job {$this->name} with PID {$this->pid}", $this->metadata);
			return unlink($this->pidfile);
		}
		return false;
	}

	function setPid($pid)
	{
		$this->pid = $pid;
    }
    
    function getPid(){
        if(!$this->pid){
            $this->load();
        }
        return $this->pid;
    }

	function setProcess( Process $process ){
		// $this->process = $process;
	}

	function setMetadata($metadata)
	{
		$this->metadata = $metadata;
	}

	function getStatus()
	{
        $pid = $this->getPid();

        if(!$pid){
            return false;
        }

		$output = TwitchHelper::exec(["ps", "-p", $pid]);

		//if (!$this->pid && !$this->tried_loading) {
		//	$this->load();
		//}
        //
		//if (!$this->pid) {
		//	return false;
		//}

		if (mb_strpos($output, $this->pid) !== false) {
			TwitchHelper::log(TwitchHelper::LOG_DEBUG, "PID file check, process is running");
			$this->status = $this->pid;
			return $this->pid;
		} else {
			TwitchHelper::log(TwitchHelper::LOG_DEBUG, "PID file check, process does not exist");
			$this->status = false;
			return false;
		}
	}

	function kill()
	{
		return TwitchHelper::exec(["kill", $this->getPid()]);
	}
}